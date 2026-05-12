import logging
import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError, ProgrammingError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.database import SessionLocal, engine, get_db
from app.db.seed import seed_demo_users
from app.db.seed_geo import seed_geography_and_partner
from app.models import Base

logger = logging.getLogger(__name__)


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

    if isinstance(exc, ProgrammingError):
        message = (
            "Database tables are missing. In Supabase → SQL Editor, run "
            "supabase/000_schema_from_alembic.sql (see supabase/README.txt), then redeploy or wait for a cold start "
            "so demo users can seed."
        )
        code = "database_schema"
    elif isinstance(exc, OperationalError):
        message = (
            "Cannot reach the database. Verify Postgres env vars on Vercel and that Supabase allows connections "
            "(pooler URI, SSL)."
        )
        code = "database_connection"
    else:
        message = (
            "Server error. On Vercel, set DATABASE_URL / POSTGRES_URL and apply migrations (see supabase/README.txt)."
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

    try:
        if settings.seed_demo_users:
            with SessionLocal() as db:
                seed_demo_users(db)

        with SessionLocal() as db:
            seed_geography_and_partner(db)
    except Exception:
        logger.exception(
            "Startup database seed failed (check Vercel env POSTGRES_URL / DATABASE_URL and Supabase migrations)."
        )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/env")
def health_env() -> dict[str, bool]:
    """Presence-only probe for DB-related env (never prints secrets)."""
    def present(key: str) -> bool:
        return bool(os.environ.get(key, "").strip())

    return {
        "has_POSTGRES_URL": present("POSTGRES_URL"),
        "has_POSTGRES_PRISMA_URL": present("POSTGRES_PRISMA_URL"),
        "has_DATABASE_URL": present("DATABASE_URL"),
        "has_SUPABASE_DATABASE_URL": present("SUPABASE_DATABASE_URL"),
        "vercel": present("VERCEL"),
    }


@app.get("/health/db")
def health_db(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}


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
