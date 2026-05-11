"""Vercel serverless entry: expose the FastAPI app from the backend package."""

import os
import sys

_BACKEND = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from app.main import app  # noqa: E402

__all__ = ["app"]
