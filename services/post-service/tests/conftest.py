import os

# Only used to construct the engine in unit tests; no connection is made.
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")
