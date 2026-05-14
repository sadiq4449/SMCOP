"""Simple per-IP sliding window rate limit for API routes (Iteration 10)."""

from __future__ import annotations

import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import get_settings


class ApiRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, api_prefix: str):
        super().__init__(app)
        self.api_prefix = api_prefix.rstrip("/") or api_prefix
        self._general: dict[str, deque[float]] = defaultdict(deque)
        self._login: dict[str, deque[float]] = defaultdict(deque)

    def _prune(self, dq: deque[float], window: float, now: float) -> None:
        while dq and dq[0] < now - window:
            dq.popleft()

    def _reject(self) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content={
                "success": False,
                "message": "Too many requests. Try again shortly.",
                "errors": {"rate_limit": "exceeded"},
            },
        )

    async def dispatch(self, request: Request, call_next) -> Response:
        settings = get_settings()
        path = request.url.path
        if not path.startswith(self.api_prefix):
            return await call_next(request)
        client = request.client
        ip = client.host if client else "unknown"
        now = time.time()
        window = 60.0

        if path.rstrip("/").endswith("/auth/login") and request.method == "POST":
            lim = max(1, settings.login_rate_limit_per_minute)
            dq = self._login[ip]
            self._prune(dq, window, now)
            if len(dq) >= lim:
                return self._reject()
            dq.append(now)
            return await call_next(request)

        lim = max(1, settings.api_rate_limit_per_minute)
        dq = self._general[ip]
        self._prune(dq, window, now)
        if len(dq) >= lim:
            return self._reject()
        dq.append(now)
        return await call_next(request)
