"""IE accounts use ``assigned_schools`` (maintained by Super Admin)."""

from __future__ import annotations

from app.models.user import UserRole

# Roles that may carry ``assigned_schools`` (visit/report scope for IE).
FIELD_ROLES = (UserRole.IE,)
