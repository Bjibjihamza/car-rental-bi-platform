import os
from pydantic import BaseModel

class Settings(BaseModel):
    oracle_host: str = os.getenv("ORACLE_HOST", "oracle-xe")
    oracle_port: int = int(os.getenv("ORACLE_PORT", "1521"))
    oracle_service: str = os.getenv("ORACLE_SERVICE", "XEPDB1")
    oracle_user: str = os.getenv("ORACLE_USER", "carrental")
    oracle_password: str = os.getenv("ORACLE_PASSWORD", "CarBI#123")

    @property
    def oracle_url(self) -> str:
        # SQLAlchemy 2.x URL for python-oracledb
        return (
            f"oracle+oracledb://{self.oracle_user}:"
            f"{self.oracle_password}@{self.oracle_host}:{self.oracle_port}/"
            f"?service_name={self.oracle_service}"
        )

settings = Settings()
