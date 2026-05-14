"""Sign and POST webhook payloads (Iteration 10 subset)."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import urllib.error
import urllib.request
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.webhook_subscription import WebhookSubscription

logger = logging.getLogger(__name__)

WEBHOOK_EVENTS = frozenset({"report_approved", "visit_submitted", "issue_resolved"})


def dispatch_webhook_event_sync(event: str, data: dict[str, Any]) -> None:
    if event not in WEBHOOK_EVENTS:
        return
    payload = {
        "event": event,
        "occurred_at": datetime.now(UTC).isoformat(),
        "data": data,
    }
    body = json.dumps(payload, default=str).encode("utf-8")
    with SessionLocal() as db:
        rows = db.scalars(
            select(WebhookSubscription).where(WebhookSubscription.is_active.is_(True)),
        ).all()
    for sub in rows:
        evs = sub.events if isinstance(sub.events, list) else []
        if event not in evs:
            continue
        try:
            sig = hmac.new(sub.secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
            req = urllib.request.Request(
                sub.url,
                data=body,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "X-SMOCP-Event": event,
                    "X-SMOCP-Signature": f"sha256={sig}",
                },
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                if resp.status >= 300:
                    logger.warning("Webhook %s returned HTTP %s", sub.id, resp.status)
        except urllib.error.HTTPError as e:
            logger.warning("Webhook HTTP error for %s: %s", sub.id, e.code)
        except Exception:
            logger.warning("Webhook delivery failed for %s", sub.id, exc_info=True)


def schedule_webhook_dispatch(event: str, data: dict[str, Any]) -> None:
    """Run synchronously in a background task worker thread context."""
    dispatch_webhook_event_sync(event, data)
