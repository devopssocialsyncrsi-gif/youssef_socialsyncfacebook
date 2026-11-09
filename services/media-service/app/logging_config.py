import json
import logging
import os
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    def __init__(self, service):
        super().__init__()
        self.service = service

    def format(self, record):
        message = record.getMessage()
        try:
            payload = json.loads(message)
            if not isinstance(payload, dict):
                payload = {"message": message}
        except (TypeError, ValueError):
            payload = {"message": message}
        payload.setdefault("service", self.service)
        payload.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
        payload.setdefault("level", record.levelname.lower())
        payload.setdefault("logger", record.name)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(service):
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter(service))
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "httpx"):
        logger = logging.getLogger(name)
        logger.handlers.clear()
        logger.propagate = True
