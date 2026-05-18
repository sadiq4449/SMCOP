"""Aggregate monitoring score from KPI rows (Iteration 4)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.monitoring import KpiScore, Visit


def recompute_visit_aggregate(db: Session, visit_id: UUID) -> None:
    """Derive visit.aggregate_score from KPI rubric rows (weighted % of max).

    Uses each score's linked KPI row so definitions stay in sync. Non-positive
    weights are treated as 1.0 so a misconfigured weight does not wipe the whole score.
    """
    visit = db.get(Visit, visit_id)
    if not visit:
        return

    scores = db.scalars(
        select(KpiScore).where(KpiScore.visit_id == visit_id).options(joinedload(KpiScore.kpi)),
    ).unique().all()
    if not scores:
        visit.aggregate_score = None
        return

    weighted_score = 0.0
    weighted_max = 0.0
    ratio_parts: list[float] = []
    for s in scores:
        kpi = s.kpi
        if not kpi:
            continue
        mx = int(kpi.max_score)
        if mx <= 0:
            continue
        w = float(kpi.weight) if kpi.weight is not None else 1.0
        if w <= 0:
            w = 1.0
        part = (float(s.score) / float(mx)) * w
        weighted_score += part
        weighted_max += w
        ratio_parts.append(float(s.score) / float(mx))

    if weighted_max > 0:
        visit.aggregate_score = round((weighted_score / weighted_max) * 100, 2)
    elif ratio_parts:
        visit.aggregate_score = round((sum(ratio_parts) / len(ratio_parts)) * 100, 2)
    else:
        visit.aggregate_score = None
