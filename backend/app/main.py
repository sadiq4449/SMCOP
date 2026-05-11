from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.database import SessionLocal, engine
from app.db.seed import seed_demo_users
from app.db.seed_geo import seed_geography_and_partner
from app.models import Base


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


@app.on_event("startup")
def on_startup() -> None:
    if settings.database_url.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)

    if settings.seed_demo_users:
        with SessionLocal() as db:
            seed_demo_users(db)

    with SessionLocal() as db:
        seed_geography_and_partner(db)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


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
