"""Runtime configuration for the Virtual R&D Lab backend.

All values can be overridden through environment variables or a local ``.env``
file (see ``.env.example``). Secrets are **never** hardcoded here.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_ROOT.parent


class Settings(BaseSettings):
    """Application settings, loaded from the environment."""

    model_config = SettingsConfigDict(
        env_file=(BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- app ------------------------------------------------------------- #
    app_name: str = "Virtual R&D Lab API"
    app_version: str = "0.1.0"
    debug: bool = True
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    #: Dev convenience: Vite silently moves to the next free port (5174, 5175, ...)
    #: when 5173 is taken, and a strict allow-list then blocks the browser with a
    #: CORS preflight failure that looks like "cannot reach the backend". Allowing
    #: any localhost port avoids that trap. Set to an empty string to disable.
    cors_origin_regex: str = r"http://(localhost|127\.0\.0\.1)(:\d+)?"

    # --- artifacts -------------------------------------------------------- #
    model_path: str = str(BACKEND_ROOT / "models" / "experiment_model.pkl")
    model_metadata_path: str = str(BACKEND_ROOT / "models" / "model_metadata.json")
    dataset_path: str = str(BACKEND_ROOT / "training" / "dataset.csv")
    rag_documents_dir: str = str(BACKEND_ROOT / "rag" / "documents")
    rag_index_dir: str = str(BACKEND_ROOT / "rag" / "index")
    database_path: str = str(BACKEND_ROOT / "data" / "virtual_rd_lab.db")

    # --- retrieval -------------------------------------------------------- #
    # auto | sentence-transformers | tfidf
    embedding_backend: str = "auto"
    embedding_model: str = "all-MiniLM-L6-v2"
    chunk_size: int = 700
    chunk_overlap: int = 120
    rag_top_k: int = 4

    # --- LLM -------------------------------------------------------------- #
    # none | openai | groq | ollama | custom
    llm_provider: str = "none"
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_model: str = ""
    llm_temperature: float = 0.2
    llm_max_tokens: int = 1200
    llm_timeout_seconds: float = 45.0

    # --- experiment generation ------------------------------------------- #
    search_grid_size: int = 900
    default_num_experiments: int = 5

    # --- authentication & security --------------------------------------- #
    jwt_secret_key: str = "nucleus-ai-secret-key-change-in-production-2026"
    jwt_algorithm: str = "HS256"
    jwt_expires_in_minutes: int = 60 * 24 * 7  # 7 days
    admin_email: str = "admin@nucleus.ai"
    admin_password: str = "AdminNucleus2026!"
    admin_name: str = "Nucleus Administrator"
    admin_organization: str = "Nucleus AI Core Operations"

    @property
    def cors_origin_list(self) -> List[str]:
        raw = (self.cors_origins or "").strip()
        if not raw or raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @property
    def cors_origin_pattern(self) -> str | None:
        """Regex form of the allowed origins, or None when disabled."""
        pattern = (self.cors_origin_regex or "").strip()
        return pattern or None

    @property
    def llm_enabled(self) -> bool:
        """True when an external LLM is configured (otherwise template mode)."""
        provider = (self.llm_provider or "none").lower()
        if provider in ("", "none", "off", "disabled"):
            return False
        if provider == "ollama":
            return True
        return bool(self.llm_api_key)


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor."""
    return Settings()


settings = get_settings()
