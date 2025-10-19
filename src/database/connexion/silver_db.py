from .db_core import OracleClient

# Utilise SILVER_USER / SILVER_PASSWORD du .env
silver_db = OracleClient(
    user_env="SILVER_USER",
    password_env="SILVER_PASSWORD",
    autocommit=False,
)
