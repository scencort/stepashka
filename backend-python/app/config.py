from __future__ import annotations

from pathlib import Path
from pydantic_settings import BaseSettings

_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    port: int = 4000
    database_url: str = "postgresql://postgres:postgres@localhost:5432/stepashka"
    frontend_origin: str = "http://localhost:5173,http://localhost:5174"

    jwt_access_secret: str = "dev_access_secret_change_me"
    jwt_refresh_secret: str = "dev_refresh_secret_change_me"
    jwt_access_ttl_minutes: int = 60
    jwt_refresh_days: int = 7
    reset_token_ttl_minutes: int = 30

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_secure: bool = False
    smtp_user: str = ""
    smtp_pass: str = ""
    smtp_from: str = "Stepashka <no-reply@stepashka.dev>"
    show_dev_reset_code: bool = True

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    ai_provider: str = "groq"  # groq | gemini

    model_config = {"env_file": str(_ENV_FILE), "env_file_encoding": "utf-8"}


settings = Settings()
