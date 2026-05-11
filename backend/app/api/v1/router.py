from fastapi import APIRouter

from app.api.v1 import admin, auth, geography, partner_orgs, schools

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(geography.router)
api_router.include_router(partner_orgs.router)
api_router.include_router(schools.router)
