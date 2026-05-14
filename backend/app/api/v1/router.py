from fastapi import APIRouter

from app.api.v1 import admin, attendance, auth, class_observation, dashboard, documents, geography, kpis, partner_orgs, reports, schools, users, visits

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(admin.router)
api_router.include_router(dashboard.router)
api_router.include_router(kpis.router)
api_router.include_router(visits.router)
api_router.include_router(class_observation.router)
api_router.include_router(attendance.router)
api_router.include_router(documents.router)
api_router.include_router(geography.router)
api_router.include_router(partner_orgs.router)
api_router.include_router(schools.router)
api_router.include_router(reports.router)