import json
import logging
import os
import tempfile
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
import redis
from fastapi import FastAPI, Request
from fastapi.responses import Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from .adapters import ADAPTERS, PermanentPublishError
from .logging_config import configure_logging

configure_logging("publisher-service")
logger = logging.getLogger("socialsync.publisher")
PROCESSED = Counter("socialsync_jobs_processed_total", "Completed publishing jobs", ["platform", "status"])
FAILED = Counter("socialsync_jobs_failed_total", "Failed publishing jobs", ["platform"])
DURATION = Histogram("socialsync_job_duration_seconds", "Publishing job duration", ["platform"])
stop_event = threading.Event()
queue = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"), decode_responses=True, socket_connect_timeout=3)


def log(event, **fields):
    logger.info(json.dumps({"service": "publisher-service", "event": event, **fields}, default=str))


def report(job, status, attempts, **fields):
    url = f"{os.getenv('POST_SERVICE_URL', 'http://post-service:8000')}/internal/posts/{job['post_id']}/targets/{job['platform']}"
    response = httpx.patch(url, headers={"X-Internal-API-Key": os.getenv("INTERNAL_API_KEY", ""), "X-Request-ID": job.get("request_id", "")}, json={"status": status, "attempts": attempts, **fields}, timeout=10)
    response.raise_for_status()


def process(job):
    platform = job["platform"]
    started = time.monotonic()
    request_id = job.get("request_id", "")
    last_error = "Unknown publishing error"
    try:
        for attempt in range(1, 4):
            if stop_event.is_set():
                queue.lpush("publish_jobs", json.dumps(job))
                return
            try:
                report(job, "processing", attempt)
                base = os.getenv("MEDIA_SERVICE_URL", "http://media-service:8001")
                headers = {"X-Request-ID": request_id}
                with httpx.Client(timeout=180) as client:
                    response = client.get(f"{base}/media/{job['media_id']}", headers=headers)
                    response.raise_for_status()
                    media = response.json()
                    with tempfile.TemporaryDirectory() as temp:
                        local = Path(temp) / ("upload.mp4" if media["publish_mime_type"] == "video/mp4" else "upload.png")
                        with client.stream("GET", f"{base}/media/{job['media_id']}/file", headers=headers) as source, local.open("wb") as target:
                            source.raise_for_status()
                            for chunk in source.iter_bytes():
                                target.write(chunk)
                        media["local_path"] = str(local)
                        result = ADAPTERS[platform].publish(job, media)
                report(job, "published", attempt, external_id=result.external_id, external_url=result.external_url)
                PROCESSED.labels(platform, "published").inc()
                log("published", request_id=request_id, post_id=job["post_id"], platform=platform, attempt=attempt)
                return
            except PermanentPublishError as exc:
                last_error = str(exc)
                break
            except Exception as exc:
                last_error = str(exc)[:1000]
                log("attempt_failed", request_id=request_id, platform=platform, attempt=attempt, error=last_error)
                if attempt < 3 and stop_event.wait(2 ** (attempt - 1)):
                    queue.lpush("publish_jobs", json.dumps(job))
                    return
        try:
            report(job, "failed", attempt, error=last_error)
        except Exception as exc:
            log("status_update_failed", request_id=request_id, error=str(exc))
            queue.lpush("publish_jobs", json.dumps(job))
            return
        FAILED.labels(platform).inc()
        PROCESSED.labels(platform, "failed").inc()
    finally:
        DURATION.labels(platform).observe(time.monotonic() - started)


def worker():
    log("worker_started")
    while not stop_event.is_set():
        try:
            item = queue.brpop("publish_jobs", timeout=2)
            if item:
                job = json.loads(item[1])
                process(job)
        except (redis.RedisError, ValueError, KeyError) as exc:
            log("worker_error", error=str(exc))
            stop_event.wait(2)
    log("worker_stopped")


@asynccontextmanager
async def lifespan(_app):
    stop_event.clear()
    thread = threading.Thread(target=worker, name="publisher-worker", daemon=True)
    thread.start()
    yield
    stop_event.set()
    thread.join(timeout=10)


app = FastAPI(title="SocialSync publisher-service", lifespan=lifespan)


@app.middleware("http")
async def correlation(request: Request, call_next):
    request_id = (request.headers.get("x-request-id") or str(uuid.uuid4()))[:128]
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    log("request", request_id=request_id, method=request.method, path=request.url.path, status=response.status_code)
    return response


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def ready():
    try:
        queue.ping()
        return {"status": "ready"}
    except redis.RedisError:
        return Response(status_code=503, content="Queue unavailable")


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
