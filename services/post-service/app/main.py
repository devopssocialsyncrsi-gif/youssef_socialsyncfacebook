import hmac
import json
import logging
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

import httpx
import jwt
import redis
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from .db import get_db
from .logging_config import configure_logging
from .models import Post, PostTarget, now

Platform = Literal["linkedin", "facebook", "instagram", "youtube"]
TargetStatus = Literal["pending", "processing", "published", "failed"]
app = FastAPI(title="SocialSync post-service")
configure_logging("post-service")
logger = logging.getLogger("socialsync.posts")
queue = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"), decode_responses=True, socket_connect_timeout=3)


def log(event: str, **fields):
    logger.info(json.dumps({"service": "post-service", "event": event, **fields}, default=str))


@app.middleware("http")
async def correlation(request: Request, call_next):
    request.state.request_id = (request.headers.get("x-request-id") or str(uuid.uuid4()))[:128]
    start = time.monotonic()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    log("request", request_id=request.state.request_id, method=request.method, path=request.url.path, status=response.status_code, duration_ms=round((time.monotonic() - start) * 1000))
    return response


class Login(BaseModel):
    username: str
    password: str


class PostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    caption: str = Field(max_length=63206)
    media_id: uuid.UUID
    platforms: list[Platform] = Field(min_length=1, max_length=4)

    @field_validator("title")
    @classmethod
    def nonblank_title(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be blank")
        return value

    @field_validator("platforms")
    @classmethod
    def unique_platforms(cls, value):
        if len(value) != len(set(value)):
            raise ValueError("Each platform can only be selected once")
        return value


class StatusUpdate(BaseModel):
    status: TargetStatus
    attempts: int = Field(default=0, ge=0)
    external_id: str | None = None
    external_url: str | None = None
    error: str | None = None


def require_user(authorization: str | None = Header(default=None)):
    secret = os.getenv("JWT_SECRET", "")
    if not secret or not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    try:
        return jwt.decode(authorization[7:], secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(401, "Invalid or expired session") from exc


def require_internal(x_internal_api_key: str | None = Header(default=None)):
    expected = os.getenv("INTERNAL_API_KEY", "")
    if not expected or not x_internal_api_key or not hmac.compare_digest(expected, x_internal_api_key):
        raise HTTPException(403, "Invalid internal key")


def serialize(post: Post):
    return {"id": str(post.id), "title": post.title, "caption": post.caption, "media_id": str(post.media_id), "status": post.status, "created_at": post.created_at.isoformat(), "updated_at": post.updated_at.isoformat(), "targets": [{"id": str(t.id), "platform": t.platform, "status": t.status, "attempts": t.attempts, "external_id": t.external_id, "external_url": t.external_url, "error": t.error, "updated_at": t.updated_at.isoformat()} for t in post.targets]}


def get_post(db: Session, post_id: uuid.UUID):
    post = db.scalar(select(Post).where(Post.id == post_id).options(selectinload(Post.targets)))
    if not post:
        raise HTTPException(404, "Post not found")
    return post


def make_job(post: Post, target: PostTarget, request_id: str):
    return json.dumps({"post_id": str(post.id), "target_id": str(target.id), "platform": target.platform, "title": post.title, "caption": post.caption, "media_id": str(post.media_id), "request_id": request_id})


def verify_media(media_id: uuid.UUID, request_id: str):
    try:
        response = httpx.get(f"{os.getenv('MEDIA_SERVICE_URL', 'http://media-service:8001')}/media/{media_id}", headers={"X-Request-ID": request_id}, timeout=10)
        if response.status_code == 404:
            raise HTTPException(422, "Media not found")
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(503, "Media service unavailable") from exc


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def ready(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        queue.ping()
        return {"status": "ready"}
    except Exception as exc:
        raise HTTPException(503, "Database or queue unavailable") from exc


@app.post("/auth/login")
def login(credentials: Login):
    username, password, secret = os.getenv("ADMIN_USER", ""), os.getenv("ADMIN_PASSWORD", ""), os.getenv("JWT_SECRET", "")
    if not username or not password or not secret or not (hmac.compare_digest(credentials.username, username) and hmac.compare_digest(credentials.password, password)):
        raise HTTPException(401, "Invalid username or password")
    token = jwt.encode({"sub": username, "exp": datetime.now(timezone.utc) + timedelta(hours=12)}, secret, algorithm="HS256")
    return {"access_token": token, "token_type": "bearer"}


@app.post("/posts", status_code=201, dependencies=[Depends(require_user)])
def create_post(payload: PostCreate, request: Request, db: Session = Depends(get_db)):
    verify_media(payload.media_id, request.state.request_id)
    try:
        queue.ping()
    except redis.RedisError as exc:
        raise HTTPException(503, "Publishing queue unavailable") from exc
    stamp = now()
    post = Post(id=uuid.uuid4(), title=payload.title.strip(), caption=payload.caption, media_id=payload.media_id, status="pending", created_at=stamp, updated_at=stamp)
    post.targets = [PostTarget(id=uuid.uuid4(), platform=p, status="pending", attempts=0, updated_at=stamp) for p in payload.platforms]
    db.add(post)
    db.commit()
    for target in post.targets:
        try:
            queue.lpush("publish_jobs", make_job(post, target, request.state.request_id))
        except redis.RedisError:
            target.status, target.error = "failed", "Could not enqueue this target. Please retry."
            post.status = "failed"
    db.commit()
    return serialize(post)


@app.get("/posts", dependencies=[Depends(require_user)])
def list_posts(db: Session = Depends(get_db)):
    posts = db.scalars(select(Post).options(selectinload(Post.targets)).order_by(Post.created_at.desc()).limit(200)).all()
    return [serialize(post) for post in posts]


@app.get("/posts/{post_id}", dependencies=[Depends(require_user)])
def read_post(post_id: uuid.UUID, db: Session = Depends(get_db)):
    return serialize(get_post(db, post_id))


@app.post("/posts/{post_id}/targets/{platform}/retry", dependencies=[Depends(require_user)])
def retry(post_id: uuid.UUID, platform: Platform, request: Request, db: Session = Depends(get_db)):
    post = get_post(db, post_id)
    target = next((t for t in post.targets if t.platform == platform), None)
    if not target:
        raise HTTPException(404, "Target not found")
    if target.status != "failed":
        raise HTTPException(409, "Only failed targets can be retried")
    try:
        queue.ping()
        target.status, target.attempts, target.error, target.updated_at = "pending", 0, None, now()
        post.status, post.updated_at = "pending", now()
        db.commit()
        queue.lpush("publish_jobs", make_job(post, target, request.state.request_id))
    except redis.RedisError as exc:
        target.status, target.error = "failed", "Could not enqueue this target. Please retry."
        post.status = "failed"
        db.commit()
        raise HTTPException(503, "Publishing queue unavailable") from exc
    return serialize(post)


@app.patch("/internal/posts/{post_id}/targets/{platform}", dependencies=[Depends(require_internal)])
def update_target(post_id: uuid.UUID, platform: Platform, update: StatusUpdate, db: Session = Depends(get_db)):
    post = get_post(db, post_id)
    target = next((t for t in post.targets if t.platform == platform), None)
    if not target:
        raise HTTPException(404, "Target not found")
    target.status, target.attempts = update.status, update.attempts
    target.external_id, target.external_url, target.error, target.updated_at = update.external_id, update.external_url, update.error, now()
    statuses = [t.status for t in post.targets]
    post.status = "processing" if "processing" in statuses else "pending" if "pending" in statuses else "failed" if "failed" in statuses else "published"
    post.updated_at = now()
    db.commit()
    return serialize(post)
