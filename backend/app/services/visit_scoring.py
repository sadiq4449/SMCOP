"""Aggregate monitoring score from KPI rows (Iteration 4)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.monitoring import KPI, KpiScore, Visit


def recompute_visit_aggregate(db: Session, visit_id: UUID) -> None:
    visit = db.get(Visit, visit_id)
    if not visit:
        return

    scores = db.scalars(select(KpiScore).where(KpiScore.visit_id == visit_id)).all()
    if not scores:
        visit.aggregate_score = None
        return

    kpi_rows = db.scalars(select(KPI)).all()
    kpi_map = {k.id: (k.max_score, float(k.weight) if k.weight is not None else 1.0) for k in kpi_rows}

    weighted_score = 0.0
    weighted_max = 0.0
    for s in scores:
        meta = kpi_map.get(s.kpi_id)
        if not meta:
            continue
        mx, w = meta
        if mx <= 0 or w <= 0:
            continue
        weighted_score += (s.score / mx) * w
        weighted_max += w

    visit.aggregate_score = round((weighted_score / weighted_max) * 100, 2) if weighted_max else None
