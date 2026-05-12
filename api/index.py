"""Vercel serverless entry: expose the FastAPI app from the backend package."""

import logging
import os
import sys
import traceback

logger = logging.getLogger(__name__)

_BACKEND = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

try:
    from app.main import app  # noqa: E402
except Exception:
    _boot_trace = traceback.format_exc()
    logger.error("SMOCP backend failed to import (cold start):\n%s", _boot_trace)

    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    from starlette.responses import Response

    def _public_boot_line() -> str:
        for line in reversed(_boot_trace.strip().splitlines()):
            s = line.strip()
            if not s or s.startswith("File \"") or s.startswith("Traceback"):
                continue
            return s[:480]
        return "Import failed; open Vercel → this deployment → Functions → Logs."

    _BOOT_MESSAGE = (
        "The API process failed while loading (often missing DATABASE_URL on Vercel, or invalid env). "
        f"Detail: {_public_boot_line()}"
    )

    app = FastAPI(title="SMOCP API (boot failed)", version="0.0.0")

    _cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
    }

    def _boot_json(status: int = 503) -> JSONResponse:
        return JSONResponse(
            status_code=status,
            content={
                "success": False,
                "message": _BOOT_MESSAGE,
                "errors": {
                    "phase": "import",
                    "hint": "Vercel → Settings → Environment Variables: set DATABASE_URL or POSTGRES_URL for Production, "
                    "then Redeploy. Supabase → SQL Editor: run supabase/000_schema_from_alembic.sql. See supabase/README.txt.",
                },
            },
            headers=_cors,
        )

    @app.middleware("http")
    async def boot_failed_middleware(request: Request, _call_next):
        if request.method == "OPTIONS":
            return Response(status_code=200, headers=_cors)
        return _boot_json()

__all__ = ["app"]
