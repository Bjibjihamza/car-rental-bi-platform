import os
import contextlib
from typing import Optional, Iterable, Any, Sequence

# Essayez d'abord python-oracledb (recommandé). Tombe sur cx_Oracle si non dispo.
try:
    import oracledb  # python-oracledb
except ImportError:  # fallback
    import cx_Oracle as oracledb  # type: ignore


def _get_env(key: str, default: Optional[str] = None) -> str:
    val = os.getenv(key, default)
    if val is None:
        raise RuntimeError(f"Missing required environment variable: {key}")
    return val


class OracleClient:
    """
    Client Oracle simple, fin et robuste pour scripts ETL / DDL.
    - Mode Thin par défaut (python-oracledb), pas d'Instant Client requis.
    - Connexion via EZCONNECT: host:port/service
    - Helpers: execute, executemany, fetchall, fetchone, execute_script_file
    """

    def __init__(
        self,
        user_env: str,
        password_env: str,
        host_env: str = "ORACLE_HOST",
        port_env: str = "ORACLE_PORT",
        service_env: str = "ORACLE_SERVICE",
        autocommit: bool = False,
    ) -> None:
        self.user = _get_env(user_env)
        self.password = _get_env(password_env)
        self.host = _get_env(host_env, "localhost")
        self.port = int(_get_env(port_env, "1521"))
        self.service = _get_env(service_env, "XEPDB1")
        self.dsn = f"{self.host}:{self.port}/{self.service}"
        self.autocommit = autocommit
        self._conn = None

    def connect(self):
        if self._conn is None:
            # python-oracledb Thin mode ne nécessite rien d’autre
            self._conn = oracledb.connect(
                user=self.user,
                password=self.password,
                dsn=self.dsn,
            )
            if self.autocommit:
                try:
                    self._conn.autocommit = True  # python-oracledb
                except Exception:
                    pass  # cx_Oracle ne supporte pas toujours cette propriété

    def close(self):
        if self._conn is not None:
            try:
                self._conn.close()
            finally:
                self._conn = None

    @contextlib.contextmanager
    def cursor(self):
        self.connect()
        cur = self._conn.cursor()
        try:
            yield cur
            if not self.autocommit:
                self._conn.commit()
        except Exception:
            if not self.autocommit:
                self._conn.rollback()
            raise
        finally:
            cur.close()

    # ---------- Helpers ----------

    def execute(self, sql: str, params: Optional[Sequence[Any]] = None) -> None:
        with self.cursor() as cur:
            cur.execute(sql, params or [])

    def executemany(self, sql: str, seq_of_params: Iterable[Sequence[Any]]) -> None:
        with self.cursor() as cur:
            cur.executemany(sql, seq_of_params)

    def fetchall(
        self, sql: str, params: Optional[Sequence[Any]] = None
    ) -> list[tuple]:
        with self.cursor() as cur:
            cur.execute(sql, params or [])
            return cur.fetchall()

    def fetchone(
        self, sql: str, params: Optional[Sequence[Any]] = None
    ) -> Optional[tuple]:
        with self.cursor() as cur:
            cur.execute(sql, params or [])
            return cur.fetchone()

    def execute_script_file(self, path: str) -> None:
        """
        Exécute un script .sql (multi-statements).
        NB: pour les très gros scripts, preferer sqlplus @file.sql.
        """
        if not os.path.exists(path):
            raise FileNotFoundError(path)
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        # Découpe naïve par ';' en fin de ligne. Evite les erreurs sur PL/SQL blocs (/) :
        statements = []
        buffer = []
        for line in content.splitlines():
            # Supporte les lignes "/" pour terminer un bloc PL/SQL
            if line.strip() == "/":
                if buffer:
                    statements.append("\n".join(buffer))
                    buffer = []
                continue
            buffer.append(line)
            if line.rstrip().endswith(";"):
                statements.append("\n".join(buffer))
                buffer = []
        if buffer:
            statements.append("\n".join(buffer))

        for stmt in statements:
            s = stmt.strip().rstrip(";").strip()
            if not s:
                continue
            self.execute(s)
