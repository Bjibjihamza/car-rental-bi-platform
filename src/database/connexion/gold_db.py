from .db_core import OracleClient

# Utilise GOLD_USER / GOLD_PASSWORD du .env
gold_db = OracleClient(
    user_env="GOLD_USER",
    password_env="GOLD_PASSWORD",
    autocommit=False,
)
