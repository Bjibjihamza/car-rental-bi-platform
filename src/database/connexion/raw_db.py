from .db_core import OracleClient

# Utilise RAW_USER / RAW_PASSWORD du .env
raw_db = OracleClient(
    user_env="RAW_USER",
    password_env="RAW_PASSWORD",
    autocommit=False,
)
