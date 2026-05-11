from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User, UserRole, UserStatus

DEMO_USERS: list[dict[str, str]] = [
    {
        "full_name": "Super Admin",
        "email": "superadmin@example.com",
        "password": "Password123!",
        "role": UserRole.SUPER_ADMIN,
    },
    {
        "full_name": "Government User",
        "email": "government@example.com",
        "password": "Password123!",
        "role": UserRole.GOVERNMENT,
    },
    {
        "full_name": "District Education Officer",
        "email": "deo@example.com",
        "password": "Password123!",
        "role": UserRole.DEO,
    },
    {
        "full_name": "Field Enumerator",
        "email": "enumerator@example.com",
        "password": "Password123!",
        "role": UserRole.ENUMERATOR,
    },
    {
        "full_name": "School Principal",
        "email": "principal@example.com",
        "password": "Password123!",
        "role": UserRole.PRINCIPAL,
    },
    {
        "full_name": "School Teacher",
        "email": "teacher@example.com",
        "password": "Password123!",
        "role": UserRole.TEACHER,
    },
]


def seed_demo_users(db: Session) -> None:
    for demo_user in DEMO_USERS:
        exists = db.scalar(select(User.id).where(User.email == demo_user["email"]))
        if exists:
            continue

        db.add(
            User(
                full_name=demo_user["full_name"],
                email=demo_user["email"],
                password_hash=hash_password(demo_user["password"]),
                role=demo_user["role"],
                status=UserStatus.ACTIVE,
            )
        )

    db.commit()
