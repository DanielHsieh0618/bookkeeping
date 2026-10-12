from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/bookkeeping"
    jwt_secret: str = "dev-jwt-secret"
    internal_api_secret: str = "dev-internal-secret"
    frontend_url: str = "https://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
