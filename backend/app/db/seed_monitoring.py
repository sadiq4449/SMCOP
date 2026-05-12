"""Seed KPI catalog for SQLite / empty databases (matches Alembic 0004 UUIDs)."""

from __future__ import annotations

import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.monitoring import KPI

KPI_DEFINITIONS: list[dict] = [
    {
        "id": uuid.UUID("cb8a154b-82ad-508b-83c9-e8c5a6124117"),
        "name": "Enrollment & Attendance",
        "description": "Enrollment trends and attendance regularity.",
        "max_score": 5,
        "category": "Quarterly Monitoring",
        "sort_order": 1,
    },
    {
        "id": uuid.UUID("e5c38374-6645-5c5a-b3e9-02b03b1e1a58"),
        "name": "Classroom Instruction Quality",
        "description": "Quality of teaching and learning processes.",
        "max_score": 5,
        "category": "Quarterly Monitoring",
        "sort_order": 2,
    },
    {
        "id": uuid.UUID("c17c116e-c334-58ee-bdc5-ff37090511b8"),
        "name": "Teacher Availability",
        "description": "Staff presence and timetable coverage.",
        "max_score": 5,
        "category": "Quarterly Monitoring",
        "sort_order": 3,
    },
    {
        "id": uuid.UUID("847c1fb3-d34a-5e5a-b4a6-c0ac2b00b371"),
        "name": "School Infrastructure",
        "description": "Buildings, utilities, and facilities.",
        "max_score": 5,
        "category": "Quarterly Monitoring",
        "sort_order": 4,
    },
    {
        "id": uuid.UUID("e88d93f3-88e4-50fc-97f2-84b66d9ee755"),
        "name": "Student Learning Environment",
        "description": "Safety, hygiene, and learner experience.",
        "max_score": 5,
        "category": "Quarterly Monitoring",
        "sort_order": 5,
    },
    {
        "id": uuid.UUID("c4cc94c1-56f6-568f-ab53-6fc238ae93b4"),
        "name": "Management & Governance",
        "description": "Leadership, records, and SMC engagement.",
        "max_score": 5,
        "category": "Quarterly Monitoring",
        "sort_order": 6,
    },
    {
        "id": uuid.UUID("37daaf67-680c-5338-8a4c-07d8bf3acc9b"),
        "name": "Community Engagement",
        "description": "Parent and community participation.",
        "max_score": 5,
        "category": "Quarterly Monitoring",
        "sort_order": 7,
    },
]


def seed_kpis_if_empty(db: Session) -> None:
    exists = db.scalar(select(KPI.id).limit(1))
    if exists:
        return
    for row in KPI_DEFINITIONS:
        db.add(KPI(**row))
    db.commit()
