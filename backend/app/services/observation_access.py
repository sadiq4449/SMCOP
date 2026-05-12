"""Classroom observation visibility (Iteration 5)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.monitoring import ClassroomObservation, Visit
from app.models.user import User, UserRole
from app.services.visit_access import can_mutate_visit, can_read_visit


def get_observation(db: Session, observation_id: UUID) -> ClassroomObservation | None:
    return db.get(ClassroomObservation, observation_id)


def can_read_observation(db: Session, user: User, observation: ClassroomObservation) -> bool:
    visit = db.get(Visit, observation.visit_id)
    if not visit:
        return False
    return can_read_visit(db, user, visit)


def can_mutate_observation(db: Session, user: User, observation: ClassroomObservation) -> bool:
    visit = db.get(Visit, observation.visit_id)
    if not visit:
        return False
    return can_mutate_visit(db, user, visit)


def can_review_observation_comments(db: Session, user: User, observation: ClassroomObservation) -> bool:
    """DEO may attach reviewer comments on finalized visits within district."""
    if user.role != UserRole.DEO:
        return False
    visit = db.get(Visit, observation.visit_id)
    if not visit:
        return False
    if visit.status.value != "finalized":
        return False
    return can_read_visit(db, user, visit)
