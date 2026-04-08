from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # Supabase — required in production, empty string allowed in dev scaffold
    SUPABASE_URL: str = Field(default="")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(default="")
    SUPABASE_JWT_SECRET: str = Field(default="")
    SUPABASE_JWKS_CACHE_TTL_SECONDS: int = 300

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Execution
    NODE_EXECUTION_TIMEOUT_SECONDS: int = 60

    # CORS — comma-separated origins accepted as list via pydantic parsing
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # API server
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    # LLM providers
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""

    # Integration provider tokens (Sequence D scaffold)
    SLACK_BOT_TOKEN: str = ""
    GMAIL_ACCESS_TOKEN: str = ""
    GOOGLE_SHEETS_ACCESS_TOKEN: str = ""
    NOTION_TOKEN: str = ""

    # Temporal
    TEMPORAL_HOST: str = "localhost:7233"
    TEMPORAL_NAMESPACE: str = "default"

    # Vercel (Epic 6)
    VERCEL_API_TOKEN: str = ""
    VERCEL_TEAM_ID: str = ""

    # Public API URL (for MCP manifest, webhook docs)
    API_PUBLIC_URL: str = "http://localhost:8000"

    # Stripe (Epic 7)
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # Workflow webhooks — if set, X-Webhook-Secret header must match
    FORGE_WEBHOOK_SECRET: str = ""

    # Sentry (Epic 8)
    SENTRY_DSN: str = ""

    # Liveblocks (Epic 8)
    LIVEBLOCKS_SECRET_KEY: str = ""

    # Per-user BYOK vault: AES key material is SHA256(pepper + user_id).
    # If unset, falls back to SUPABASE_JWT_SECRET (legacy single global key for stored API keys).
    BYOK_VAULT_PEPPER: str = ""

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"


settings = Settings()
