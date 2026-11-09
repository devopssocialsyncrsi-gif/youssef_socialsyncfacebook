FROM python:3.12-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/* && groupadd -g 10001 app && useradd -u 10001 -g app -m app && mkdir -p /app /data && chown -R app:app /app /data
COPY --from=builder /install /usr/local
WORKDIR /app
COPY --chown=app:app . .
USER app
EXPOSE 8001
HEALTHCHECK --interval=15s --timeout=4s --retries=5 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=3)" || exit 1
CMD ["sh", "-c", "if [ \"${RUN_MIGRATIONS:-true}\" = true ]; then alembic upgrade head; fi; exec uvicorn app.main:app --host 0.0.0.0 --port 8001"]
