from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.monitoring import KPI
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.monitoring import KPIOut

router = APIRouter(prefix="/kpis", tags=["kpis"])


@router.get("", response_model=APIResponse[list[KPIOut]])
def list_kpis(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[list[KPIOut]]:
    rows = db.scalars(select(KPI).order_by(KPI.sort_order, KPI.name)).all()
    data = [
        KPIOut(
            id=str(k.id),
            name=k.name,
            description=k.description,
            max_score=k.max_score,
            category=k.category,
            sort_order=k.sort_order,
        )
        for k in rows
    ]
    return APIResponse(success=True, message="KPI catalog fetched successfully", data=data)
