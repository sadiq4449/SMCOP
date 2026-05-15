from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.partner_org import PartnerOrg
from app.models.user import User, UserRole, UserStatus

DEMO_USERS: list[dict[str, object]] = [
    {
        "full_name": "Super Admin",
        "email": "superadmin@example.com",
        "password": "Password123!",
        "role": UserRole.SUPER_ADMIN,
    },
    {
        "full_name": "PPP Node (Government)",
        "email": "government@example.com",
        "password": "Password123!",
        "role": UserRole.GOVERNMENT,
    },
    {
        "full_name": "Independent Evaluator",
        "email": "ie@example.com",
        "password": "Password123!",
        "role": UserRole.IE,
    },
]


def seed_demo_users(db: Session) -> None:
    rows: list[dict[str, object]] = list(DEMO_USERS)
    partner_id = db.scalar(select(PartnerOrg.id).limit(1))
    if partner_id:
        rows.append(
            {
                "full_name": "Partner Organization",
                "email": "partner@example.com",
                "password": "Password123!",
                "role": UserRole.PARTNER,
                "partner_org_id": partner_id,
            },
        )

    for demo in rows:
        email = str(demo["email"])
        exists = db.scalar(select(User.id).where(User.email == email))
        if exists:
            continue

        role = demo["role"]
        partner_org_id = demo.get("partner_org_id")

        db.add(
            User(
                full_name=str(demo["full_name"]),
                email=email,
                password_hash=hash_password(str(demo["password"])),
                role=role,  # type: ignore[arg-type]
                status=UserStatus.ACTIVE,
                partner_org_id=partner_org_id,  # type: ignore[arg-type]
            ),
        )

    db.commit()
