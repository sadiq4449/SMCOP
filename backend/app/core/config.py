import os
from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Env names that set `database_url` (must match validation_alias).
DATABASE_ENV_KEYS = (
    "DATABASE_URL",
    "SUPABASE_DATABASE_URL",
    "SUPABASE_DB_URL",
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    # Vercel “Connect Supabase Storage” sometimes injects `sm_db_`-prefixed copies:
    "sm_db_POSTGRES_URL",
    "sm_db_POSTGRES_PRISMA_URL",
)


def any_database_env_defined() -> bool:
    return any(os.environ.get(k, "").strip() for k in DATABASE_ENV_KEYS)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env",) if not os.environ.get("VERCEL") else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = Field(
        default="postgresql+psycopg2://smocp:smocp@localhost:5432/smocp",
        validation_alias=AliasChoices(
            "DATABASE_URL",
            "SUPABASE_DATABASE_URL",
            "SUPABASE_DB_URL",
            "POSTGRES_URL",
            "POSTGRES_PRISMA_URL",
            "sm_db_POSTGRES_URL",
            "sm_db_POSTGRES_PRISMA_URL",
        ),
    )
    secret_key: str = "change-me-to-a-long-random-secret"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:5173"
    environment: str = "development"
    seed_demo_users: bool = True
    jwt_algorithm: str = "HS256"
    upload_dir: str = Field(default="uploads", validation_alias=AliasChoices("UPLOAD_DIR"))
    max_upload_mb: int = Field(default=12, validation_alias=AliasChoices("MAX_UPLOAD_MB"))

    @property
    def upload_root(self) -> Path:
        """Directory for evidence files (relative paths resolved under backend/)."""
        base = Path(__file__).resolve().parent.parent
        p = Path(self.upload_dir)
        return p if p.is_absolute() else (base / p)

    @field_validator("database_url", mode="before")
    @classmethod
    def _strip_database_url(cls, v: object) -> object:
        if isinstance(v, str):
            s = v.strip()
            if "\n" in s or "\r" in s:
                s = s.split()[0]
            return s
        return v

    @field_validator("seed_demo_users", mode="before")
    @classmethod
    def _coerce_bool(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip().lower() in ("1", "true", "yes", "on")
        return v

    @model_validator(mode="after")
    def _require_database_env_on_vercel(self) -> "Settings":
        if not os.environ.get("VERCEL"):
            return self
        if not any_database_env_defined():
            raise ValueError(
                "Vercel has no DATABASE_URL / POSTGRES_URL / sm_db_POSTGRES_* (or other URL aliases) "
                "in the runtime environment. Add one under Project Settings → Environment Variables "
                "for Production (and Preview if you use preview URLs), then Redeploy. "
                "See supabase/README.txt."
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
