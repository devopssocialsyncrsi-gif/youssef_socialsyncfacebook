import asyncio
import json
import logging
import os
import re
import subprocess
import time
import uuid
from pathlib import Path

import jwt
from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from .db import get_db
from .logging_config import configure_logging
from .models import MediaFile
from .validation import validate_upload

app = FastAPI(title="SocialSync media-service")
logger = logging.getLogger("socialsync.media")
configure_logging("media-service")
DATA = Path(os.getenv("MEDIA_DIR", "/data"))
MAX_BYTES = int(os.getenv("MAX_UPLOAD_MB", "200")) * 1024 * 1024


def log(event: str, **fields):
    logger.info(json.dumps({"service": "media-service", "event": event, **fields}, default=str))


@app.middleware("http")
async def correlation(request: Request, call_next):
    request_id = (request.headers.get("x-request-id") or str(uuid.uuid4()))[:128]
    start = time.monotonic()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    log("request", request_id=request_id, method=request.method, path=request.url.path, status=response.status_code, duration_ms=round((time.monotonic() - start) * 1000))
    return response


def require_user(authorization: str | None = Header(default=None)):
    secret = os.getenv("JWT_SECRET", "")
    if not secret or not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    try:
        jwt.decode(authorization[7:], secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(401, "Invalid or expired session") from exc


def serialize(media: MediaFile):
    return {"id": str(media.id), "original_name": media.original_name, "mime_type": media.mime_type, "size_bytes": media.size_bytes, "converted": bool(media.converted_path), "publish_mime_type": "video/mp4" if media.converted_path else media.mime_type, "created_at": media.created_at.isoformat()}


def get_media(db: Session, media_id: uuid.UUID) -> MediaFile:
    media = db.get(MediaFile, media_id)
    if not media:
        raise HTTPException(404, "Media not found")
    return media


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def ready(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        DATA.mkdir(parents=True, exist_ok=True)
        return {"status": "ready"}
    except Exception as exc:
        raise HTTPException(503, "Database or storage unavailable") from exc


@app.post("/media", status_code=201, dependencies=[Depends(require_user)])
async def upload(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = Path(file.filename or "").name[:255]
    media_id = uuid.uuid4()
    DATA.mkdir(parents=True, exist_ok=True)
    path = DATA / f"{media_id}{Path(filename).suffix.lower()}"
    converted = DATA / f"{media_id}-converted.mp4"
    size = 0
    try:
        first = await file.read(32)
        try:
            mime = validate_upload(filename, file.content_type or "", first)
        except ValueError as exc:
            raise HTTPException(415, str(exc)) from exc
        with path.open("wb") as target:
            chunk = first
            while chunk:
                size += len(chunk)
                if size > MAX_BYTES:
                    raise HTTPException(413, f"File exceeds the {MAX_BYTES // 1024 // 1024} MB limit")
                target.write(chunk)
                chunk = await file.read(1024 * 1024)
        if mime == "audio/mpeg":
            command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-i", os.getenv("DEFAULT_COVER", "/app/default_cover.png"), "-i", str(path), "-c:v", "libx264", "-tune", "stillimage", "-c:a", "aac", "-b:a", "192k", "-pix_fmt", "yuv420p", "-shortest", "-movflags", "+faststart", str(converted)]
            result = await asyncio.to_thread(subprocess.run, command, capture_output=True, timeout=900)
            if result.returncode:
                raise HTTPException(422, "Could not convert this audio file. Please check that it is a valid MP3.")
        media = MediaFile(id=media_id, original_name=filename, mime_type=mime, size_bytes=size, stored_path=str(path), converted_path=str(converted) if mime == "audio/mpeg" else None)
        db.add(media)
        db.commit()
        db.refresh(media)
        return serialize(media)
    except Exception:
        path.unlink(missing_ok=True)
        converted.unlink(missing_ok=True)
        raise
    finally:
        await file.close()


@app.get("/media/{media_id}")
def metadata(media_id: uuid.UUID, db: Session = Depends(get_db)):
    return serialize(get_media(db, media_id))


@app.api_route("/media/{media_id}/file", methods=["GET", "HEAD"])
def media_file(media_id: uuid.UUID, request: Request, variant: str = "publish", db: Session = Depends(get_db)):
    media = get_media(db, media_id)
    if variant not in ("publish", "original", "instagram"):
        raise HTTPException(400, "Unknown file variant")
    is_converted = variant != "original" and bool(media.converted_path)
    path = Path(media.converted_path if is_converted else media.stored_path)
    if not path.is_file():
        raise HTTPException(404, "File not found")
    is_instagram_image = variant == "instagram" and media.mime_type == "image/png"
    if is_instagram_image:
        jpeg = path.with_name(f"{media.id}-instagram.jpg")
        if not jpeg.is_file():
            temporary = path.with_name(f".{media.id}-{uuid.uuid4().hex}.jpg")
            try:
                result = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(path), "-frames:v", "1", "-q:v", "2", str(temporary)], capture_output=True, timeout=120)
                if result.returncode:
                    raise HTTPException(422, "Could not prepare this PNG for Instagram.")
                temporary.replace(jpeg)
            finally:
                temporary.unlink(missing_ok=True)
        path = jpeg
    size = path.stat().st_size
    start, end, status = 0, size - 1, 200
    range_header = request.headers.get("range")
    if range_header:
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
        if not match or not any(match.groups()):
            return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
        first, last = match.groups()
        if not first:
            suffix = int(last)
            start = max(size - suffix, 0)
        else:
            start = int(first)
            end = min(int(last), size - 1) if last else size - 1
        if start >= size or start > end or (not first and int(last) == 0):
            return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
        status = 206
    headers = {"Accept-Ranges": "bytes", "Content-Length": str(end - start + 1), "Cache-Control": "public, max-age=3600"}
    if status == 206:
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    content_type = "image/jpeg" if is_instagram_image else "video/mp4" if is_converted else media.mime_type
    if request.method == "HEAD":
        return Response(status_code=status, headers=headers, media_type=content_type)

    def chunks():
        with path.open("rb") as source:
            source.seek(start)
            remaining = end - start + 1
            while remaining:
                part = source.read(min(1024 * 1024, remaining))
                if not part:
                    break
                remaining -= len(part)
                yield part
    return StreamingResponse(chunks(), status_code=status, headers=headers, media_type=content_type)


@app.delete("/media/{media_id}", status_code=204, dependencies=[Depends(require_user)])
def delete_media(media_id: uuid.UUID, db: Session = Depends(get_db)):
    media = get_media(db, media_id)
    paths = [media.stored_path, media.converted_path, str(Path(media.stored_path).with_name(f"{media.id}-instagram.jpg"))]
    db.delete(media)
    db.commit()
    for path in paths:
        if path:
            Path(path).unlink(missing_ok=True)
    return Response(status_code=204)
