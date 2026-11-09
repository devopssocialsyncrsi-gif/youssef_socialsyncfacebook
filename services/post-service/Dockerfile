FROM python:3.12-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
RUN groupadd -g 10001 app && useradd -u 10001 -g app -m app && mkdir /app && chown app:app /app
COPY --from=builder /install /usr/local
WORKDIR /app
COPY --chown=app:app . .
USER app
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=4s --retries=5 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)" || exit 1
CMD ["sh", "-c", "if [ \"${RUN_MIGRATIONS:-true}\" = true ]; then alembic upgrade head; fi; exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
