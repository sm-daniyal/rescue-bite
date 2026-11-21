from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "sqlite+aiosqlite:///./rescuebite_dev.db"
    gemini_api_key: str = "PLACEHOLDER"
    environment: str = "development"
    jnnce_lat: float = 13.9299
    jnnce_lng: float = 75.5681
    campus_radius_km: float = 7.0
    surplus_score_threshold: float = 0.65
    min_discount_pct: int = 25
    max_discount_pct: int = 65
    reservation_hold_minutes: int = 30


settings = Settings()
