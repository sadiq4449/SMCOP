import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

# Query params on pooled/Prisma URLs (e.g. pgbouncer, schema) are not libpq keywords;
# passing them to psycopg2 causes "invalid connection option".
_LIBPQ_QUERY_ALLOW = frozenset({
    "application_name",
    "channel_binding",
    "connect_timeout",
    "gssencmode",
    "gsslib",
    "host",
    "krbsrvname",
    "load_balance_hosts",
    "options",
    "port",
    "service",
    "sslcert",
    "sslcrl",
    "sslkey",
    "ssl_max_protocol_version",
    "ssl_min_protocol_version",
    "sslmode",
    "sslrootcert",
    "target_session_attrs",
})


def _normalize_database_url(url: str) -> str:
    url = url.strip()
    if not url or url.startswith("sqlite"):
        return url
    u = make_url(url)
    host = (u.host or "").lower()
    if "supabase" in host and "sslmode" not in u.query:
        u = u.update_query_dict({"sslmode": "require"})
    allowed_q = {k: v for k, v in u.query.items() if k in _LIBPQ_QUERY_ALLOW}
    u = u.set(query=allowed_q)
    if u.drivername != "postgresql+psycopg2":
        u = u.set(drivername="postgresql+psycopg2")
    return u.render_as_string(hide_password=False)


def _connect_args(url: str) -> dict:
    if url.startswith("sqlite"):
        return {"check_same_thread": False}
    u = make_url(url)
    if "sslmode" in u.query:
        return {}
    host = (u.host or "").lower()
    if "supabase" in host:
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
