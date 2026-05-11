import os
from collections.abc import Generator
from urllib.parse import urlparse

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings


def _normalize_database_url(url: str) -> str:
    if url.startswith("sqlite"):
        return url
    if url.startswith("postgres://"):
        url = "postgresql://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg2://" + url.removeprefix("postgresql://")
    if "supabase.co" in url and "sslmode" not in url:
        url = f"{url}{'&' if '?' in url else '?'}sslmode=require"
    return url


def _connect_args(url: str) -> dict:
    if url.startswith("sqlite"):
        return {"check_same_thread": False}
    bare = url.replace("postgresql+psycopg2://", "http://", 1)
    host = urlparse(bare).hostname or ""
    if "supabase.co" in host:
        return {"sslmode": "require"}
    return {}


settings = get_settings()
database_url = _normalize_database_url(settings.database_url)
connect_args = _connect_args(database_url)

_engine_kwargs: dict = {"pool_pre_ping": True, "connect_args": connect_args}
if os.environ.get("VERCEL"):
    _engine_kwargs["poolclass"] = NullPool

engine = create_engine(database_url, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
