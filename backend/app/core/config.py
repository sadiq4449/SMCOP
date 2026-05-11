from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = Field(
        default="postgresql+psycopg2://smocp:smocp@localhost:5432/smocp",
        validation_alias=AliasChoices("DATABASE_URL", "SUPABASE_DATABASE_URL", "SUPABASE_DB_URL"),
    )
    secret_key: str = "change-me-to-a-long-random-secret"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:5173"
    environment: str = "development"
    seed_demo_users: bool = True
    jwt_algorithm: str = "HS256"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
