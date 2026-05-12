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
    max_map = {k.id: k.max_score for k in kpi_rows}

    total_score = 0
    total_max = 0
    for s in scores:
        mx = max_map.get(s.kpi_id)
        if mx is None:
            continue
        total_score += s.score
        total_max += mx

    visit.aggregate_score = round((total_score / total_max) * 100, 2) if total_max else None
