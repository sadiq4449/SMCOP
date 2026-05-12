import logging
import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError, ProgrammingError, StatementError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_router
from app.core.config import any_database_env_defined, get_settings
from app.core.database import SessionLocal, engine, get_db
from app.db.seed import seed_demo_users
from app.db.seed_geo import seed_geography_and_partner
from app.models import Base

logger = logging.getLogger(__name__)


def _walk_exception_chain(exc: BaseException | None):
    seen: set[int] = set()
    while exc is not None and id(exc) not in seen:
        yield exc
        seen.add(id(exc))
        nxt = exc.__cause__
        if nxt is None and hasattr(exc, "orig"):
            nxt = getattr(exc, "orig", None)
        exc = nxt


def _is_undefined_table(exc: BaseException) -> bool:
    for e in _walk_exception_chain(exc):
        pgcode = getattr(e, "pgcode", None)
        if pgcode == "42P01":
            return True
        msg = str(e).lower()
        if "does not exist" in msg and ("relation" in msg or "table" in msg):
            return True
    return False


def _is_programming_related(exc: BaseException) -> bool:
    for e in _walk_exception_chain(exc):
        if isinstance(e, ProgrammingError):
            return True
        if isinstance(e, StatementError):
            orig = getattr(e, "orig", None)
            if isinstance(orig, ProgrammingError):
                return True
    return False


def _has_operational_error(exc: BaseException) -> bool:
    return any(isinstance(e, OperationalError) for e in _walk_exception_chain(exc))


def _frontend_dist_dir() -> Path | None:
    here = Path(__file__).resolve()
    candidates = (
        here.parent.parent.parent / "frontend" / "dist",
        Path.cwd() / "frontend" / "dist",
        Path.cwd().parent / "frontend" / "dist",
    )
    for dist in candidates:
        if dist.is_dir() and (dist / "index.html").is_file():
            return dist.resolve()
    return None


settings = get_settings()
frontend_dist = _frontend_dist_dir()

app = FastAPI(title="SMOCP API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict) and "success" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": str(exc.detail),
            "errors": None,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    errors: dict[str, str] = {}
    for error in exc.errors():
        location = error.get("loc", ())
        field = ".".join(str(part) for part in location if part != "body") or "request"
        errors[field] = error.get("msg", "Invalid value")

    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "message": "Validation failed",
            "errors": errors,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return JSON so clients (and axios) can show message instead of falling back to generic errors."""
    logger.exception("%s %s", request.method, request.url.path)

    if _is_programming_related(exc):
        if _is_undefined_table(exc):
            message = (
                "Database tables are missing. In Supabase → SQL Editor, run "
                "supabase/000_schema_from_alembic.sql (see supabase/README.txt), then redeploy or wait for a cold start "
                "so demo users can seed."
            )
            code = "database_schema"
        else:
            message = (
                "Database query failed. Try signing in again after a moment; "
                "or open GET /health/schema on this site to confirm tables, and check Vercel function logs."
            )
            code = "database_programming"
    elif _has_operational_error(exc):
        message = (
            "Cannot reach the database. Confirm Production env vars on Vercel (not only Preview), use the pooler URI "
            "from Supabase (try Transaction pooler port 6543 for serverless), URL-encode special characters in the "
            "password, then Redeploy. Open GET /health/env and GET /health/db for details."
        )
        code = "database_connection"
    else:
        message = (
            "Server error. If GET /health/db and GET /health/schema look healthy, check Vercel function logs for the "
            "traceback (often an app bug after deploy). Otherwise set DATABASE_URL / POSTGRES_URL on Vercel and apply "
            "migrations (see supabase/README.txt)."
        )
        code = type(exc).__name__

    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": message,
            "errors": {"code": code},
        },
    )


@app.on_event("startup")
def on_startup() -> None:
    if settings.database_url.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)

    if settings.seed_demo_users:
        try:
            with SessionLocal() as db:
                seed_demo_users(db)
            logger.info("Startup demo user seed finished.")
        except Exception:
            logger.exception("Startup demo user seed failed (check bcrypt/logs).")

    try:
        with SessionLocal() as db:
            seed_geography_and_partner(db)
        logger.info("Startup geography seed finished.")
    except Exception:
        logger.exception(
            "Startup geography/partner seed failed (often duplicates OK after first run). "
            "Check POSTGRES_URL and migrations."
        )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/env")
def health_env() -> dict[str, object]:
    """Presence-only probe for DB-related env (never prints secrets)."""
    def present(key: str) -> bool:
        return bool(os.environ.get(key, "").strip())

    hints = _database_url_hints(settings.database_url)
    return {
        "has_POSTGRES_URL": present("POSTGRES_URL"),
        "has_POSTGRES_PRISMA_URL": present("POSTGRES_PRISMA_URL"),
        "has_sm_db_POSTGRES_URL": present("sm_db_POSTGRES_URL"),
        "has_sm_db_POSTGRES_PRISMA_URL": present("sm_db_POSTGRES_PRISMA_URL"),
        "has_DATABASE_URL": present("DATABASE_URL"),
        "has_SUPABASE_DATABASE_URL": present("SUPABASE_DATABASE_URL"),
        "has_SUPABASE_DB_URL": present("SUPABASE_DB_URL"),
        "vercel": present("VERCEL"),
        "any_database_env_set": any_database_env_defined(),
        "resolved_db_host_from_url": hints.get("url_host"),
        "resolved_db_name_from_url": hints.get("url_database"),
    }


@app.get("/health/db")
def health_db() -> JSONResponse:
    """Try a round-trip; on failure return a short libpq/psycopg2 line (no secrets)."""
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except OperationalError as e:
        raw = getattr(e, "orig", None) or e
        line = str(raw).strip().split("\n", 1)[0][:280]
        return JSONResponse(
            status_code=503,
            content={"status": "error", "database": "unreachable", "detail": line},
        )

    return JSONResponse(content={"status": "ok", "database": "ok"})


_SCHEMA_TABLES = (
    "users",
    "activity_logs",
    "districts",
    "talukas",
    "union_councils",
    "partner_orgs",
    "schools",
    "school_enrollment",
    "teachers",
)


def _database_url_hints(url_str: str) -> dict[str, str | None]:
    if url_str.startswith("sqlite"):
        return {"driver": "sqlite", "url_host": None, "url_database": None}
    try:
        u = make_url(url_str)
        return {
            "driver": "postgresql",
            "url_host": u.host,
            "url_database": u.database,
        }
    except Exception:
        return {"driver": "unknown", "url_host": None, "url_database": None}


@app.get("/health/schema")
def health_schema(db: Session = Depends(get_db)) -> dict[str, object]:
    """Verify core tables exist for this deployment's DATABASE_URL (same DB as login)."""
    tables: dict[str, bool] = {}

    if settings.database_url.startswith("sqlite"):
        for name in _SCHEMA_TABLES:
            n = db.scalar(
                text("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = :t"),
                {"t": name},
            )
            tables[name] = bool(n)
    else:
        for name in _SCHEMA_TABLES:
            exists = db.scalar(
                text(
                    "SELECT EXISTS ("
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema = 'public' AND table_name = :t)"
                ),
                {"t": name},
            )
            tables[name] = bool(exists)

    users_count: int | None = None
    if tables.get("users"):
        users_count = int(db.scalar(text("SELECT COUNT(*) FROM users")) or 0)

    hints = _database_url_hints(settings.database_url)
    connection: dict[str, object | None] = {
        "driver": hints["driver"],
        "from_env_url_host": hints["url_host"],
        "from_env_url_database": hints["url_database"],
        "session_database": None,
        "session_user": None,
        "public_table_count": None,
    }
    if hints["driver"] == "postgresql":
        try:
            connection["session_database"] = db.scalar(text("SELECT current_database()"))
            connection["session_user"] = db.scalar(text("SELECT current_user"))
            connection["public_table_count"] = db.scalar(
                text(
                    "SELECT COUNT(*) FROM information_schema.tables "
                    "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
                )
            )
        except Exception:
            pass

    return {
        "tables": tables,
        "all_required_tables_present": all(tables.values()),
        "users_row_count": users_count,
        "connection": connection,
        "hint_if_all_tables_missing": (
            "Vercel is connected to a Postgres database with no app tables in schema public. "
            "Compare connection.from_env_url_host with Supabase Dashboard -> Project Settings -> Database "
            "(same project where you ran the SQL). Update POSTGRES_URL / DATABASE_URL or reconnect the Supabase integration."
        ),
    }


app.include_router(api_router, prefix=settings.api_v1_prefix)

if frontend_dist is not None:
    assets_dir = frontend_dist / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="vite_assets")


@app.get("/{full_path:path}", include_in_schema=False)
def spa_catch_all(full_path: str):
    """Serve the Vite SPA from the same origin (single Vercel deployment)."""
    if frontend_dist is None:
        raise HTTPException(status_code=404, detail="Frontend bundle not found")
    if full_path.startswith("api"):
        raise HTTPException(status_code=404, detail="Not found")
    try:
        resolved = (frontend_dist / full_path).resolve()
        resolved.relative_to(frontend_dist)
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found") from None
    if resolved.is_file():
        return FileResponse(resolved)
    return FileResponse(frontend_dist / "index.html")
