from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = Field(default="FastAPI Projects API", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")
    app_debug: bool = Field(default=True, alias="APP_DEBUG")
    app_version: str = Field(default="0.1.0", alias="APP_VERSION")

    database_url: str = Field(alias="DATABASE_URL")
    test_database_url: str | None = Field(default=None, alias="TEST_DATABASE_URL")

    jwt_secret_key: str = Field(alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=30,
        alias="ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    refresh_token_expire_days: int = Field(default=7, alias="REFRESH_TOKEN_EXPIRE_DAYS")

    cors_origins: str = Field(default="", alias="CORS_ORIGINS")

    attachment_storage_dir: Path = Field(
        default=Path("storage/attachments"),
        alias="ATTACHMENT_STORAGE_DIR",
    )
    attachment_max_size_bytes: int = Field(
        default=5 * 1024 * 1024,
        alias="ATTACHMENT_MAX_SIZE_BYTES",
        gt=0,
    )
    attachment_allowed_content_types: str = Field(
        default="image/jpeg,image/png,image/webp,application/pdf",
        alias="ATTACHMENT_ALLOWED_CONTENT_TYPES",
    )

    model_config = SettingsConfigDict(
        # O caminho absoluto evita que a leitura dependa de executar o comando
        # na raiz do repositório ou dentro de `backend/`.
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def attachment_storage_path(self) -> Path:
        """Resolve caminhos relativos a partir da raiz real do backend."""
        if self.attachment_storage_dir.is_absolute():
            return self.attachment_storage_dir

        return BACKEND_ROOT / self.attachment_storage_dir

    @property
    def attachment_allowed_content_type_set(self) -> set[str]:
        return {
            content_type.strip().lower()
            for content_type in self.attachment_allowed_content_types.split(",")
            if content_type.strip()
        }

    @property
    def cors_origin_list(self) -> list[str]:
        if not self.cors_origins:
            return []

        return [
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
