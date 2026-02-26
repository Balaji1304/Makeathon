from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "greentrack"
    db_user: str = "greentrack_user"
    db_password: str = "securepass"
    db_echo: bool = False
    admin_database_url: str | None = None
    cost_per_km: float = 1.5
    driver_cost_per_min: float = 0.5

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
