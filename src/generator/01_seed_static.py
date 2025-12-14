"""
Minimal Oracle seed script (EXACT dataset from your SQL*Plus output).
- Wipes tables in dependency-safe order
- Best-effort identity reset
- Seeds ONLY: BRANCHES, MANAGERS, CAR_CATEGORIES, IOT_DEVICES, CARS
- NO CUSTOMERS

Run:
  python seed_db_min.py
"""

from __future__ import annotations

import pandas as pd
from sqlalchemy import create_engine, text

# =============================================================================
# CONFIG
# =============================================================================

ORACLE_URL = "oracle+oracledb://"
CONNECT_ARGS = {
    "user": "raw_layer",
    "password": "Raw#123",
    "dsn": "localhost:1521/XEPDB1",
}

ENGINE = create_engine(
    ORACLE_URL,
    connect_args=CONNECT_ARGS,
    pool_pre_ping=True,
)

# Delete order (children -> parents)
WIPE_ORDER = [
    "IOT_TELEMETRY",
    "RENTALS",
    "IOT_ALERTS",
    "CARS",
    "MANAGERS",
    "IOT_DEVICES",
    "CAR_CATEGORIES",
    "CUSTOMERS",
    "BRANCHES",
]

# =============================================================================
# UTILITIES
# =============================================================================

def delete_table(conn, table: str) -> None:
    try:
        n = conn.execute(text(f"DELETE FROM {table}")).rowcount
        print(f"🧽 DELETE {table}: {n} rows")
    except Exception as e:
        print(f"⚠️ DELETE {table} failed: {e}")


def reset_identity_for_table(conn, table: str) -> None:
    """
    Best-effort reset for identity columns:
    - If USER_TAB_IDENTITY_COLS is accessible, try ALTER TABLE ... MODIFY ... GENERATED ... AS IDENTITY (START WITH 1)
    """
    try:
        ident = pd.read_sql(
            text("""
                SELECT TABLE_NAME, COLUMN_NAME
                FROM USER_TAB_IDENTITY_COLS
                WHERE TABLE_NAME = :t
            """),
            conn,
            params={"t": table.upper()},
        )
        if ident.empty:
            return

        ident.columns = [c.upper().strip() for c in ident.columns]
        col = str(ident.iloc[0]["COLUMN_NAME"]).strip()

        # This is supported on modern Oracle (12c+), may fail on some setups => best-effort.
        conn.execute(text(f"""
            ALTER TABLE {table}
            MODIFY ({col} GENERATED ALWAYS AS IDENTITY (START WITH 1))
        """))
        print(f"🔁 Reset identity {table}.{col} START WITH 1")
    except Exception:
        # ignore (best effort)
        pass


def wipe_all() -> None:
    with ENGINE.begin() as conn:
        for t in WIPE_ORDER:
            delete_table(conn, t)

        # try reset identities for your core tables only
        for t in ["BRANCHES", "MANAGERS", "CAR_CATEGORIES", "IOT_DEVICES", "CARS"]:
            reset_identity_for_table(conn, t)

    print("✅ Database wiped (minimal).")


def scalar_map(conn, sql: str, key_col: str, val_col: str) -> dict[str, int]:
    df = pd.read_sql(text(sql), conn)
    if df.empty:
        return {}
    df.columns = [c.upper().strip() for c in df.columns]
    k = key_col.upper().strip()
    v = val_col.upper().strip()
    return dict(zip(df[k].astype(str), df[v].astype(int)))


# =============================================================================
# SEED EXACT DATA
# =============================================================================

def seed_branches() -> None:
    data = [
        (1, "Carrental Executive", "Bd Al Massira, Maarif", "Casablanca", "+212522000111", "casa.hq@carrental.ma"),
        (2, "Carrental Prestige",  "Av. de France, Agdal", "Rabat",      "+212537000222", "rabat.agdal@carrental.ma"),
        (3, "Carrental Signature", "Av. Mohammed V, Gueliz", "Marrakech","+212524000333", "marrakech.gueliz@carrental.ma"),
        (4, "Carrental Select",    "Rue de la Liberté, Centre-ville", "Tanger", "+212539000444", "tanger.dt@carrental.ma"),
        (5, "Carrental Elite",     "Corniche, Plage", "Agadir", "+212602555666", "agadir.plage@carrental.ma"),
    ]
    df = pd.DataFrame(data, columns=[
        "BRANCH_ID", "BRANCH_NAME", "ADDRESS", "CITY", "PHONE", "EMAIL"
    ])

    # We want IDs EXACT, so we insert with explicit BRANCH_ID using raw SQL (not to_sql)
    with ENGINE.begin() as conn:
        for _, r in df.iterrows():
            conn.execute(text("""
                INSERT INTO BRANCHES (BRANCH_ID, BRANCH_NAME, ADDRESS, CITY, PHONE, EMAIL)
                VALUES (:id, :name, :addr, :city, :phone, :email)
            """), {
                "id": int(r["BRANCH_ID"]),
                "name": r["BRANCH_NAME"],
                "addr": r["ADDRESS"],
                "city": r["CITY"],
                "phone": r["PHONE"],
                "email": r["EMAIL"],
            })

    print("✅ Seeded BRANCHES (exact 5 rows)")


def seed_categories() -> None:
    data = [
        (1, "Economy", "Added via Dashboard"),
        (2, "Luxury",  "Added via Dashboard"),
        (3, "Electric","Added via Dashboard"),
        (4, "SUV",     "Added via Dashboard"),
    ]
    df = pd.DataFrame(data, columns=["CATEGORY_ID", "CATEGORY_NAME", "DESCRIPTION"])

    with ENGINE.begin() as conn:
        for _, r in df.iterrows():
            conn.execute(text("""
                INSERT INTO CAR_CATEGORIES (CATEGORY_ID, CATEGORY_NAME, DESCRIPTION)
                VALUES (:id, :name, :desc)
            """), {
                "id": int(r["CATEGORY_ID"]),
                "name": r["CATEGORY_NAME"],
                "desc": r["DESCRIPTION"],
            })

    print("✅ Seeded CAR_CATEGORIES (exact 4 rows)")


def seed_devices() -> None:
    data = [
        # DEVICE_ID, DEVICE_CODE, DEVICE_IMEI, FIRMWARE_VERSION, STATUS, BRANCH_ID
        (1, "DEV001", "IMEI10000000001", "v1.1.0", "ACTIVE",   5),
        (2, "DEV002", "IMEI10000000002", "v1.2.0", "ACTIVE",   1),
        (4, "DEV003", "IMEI10000000003", "v1.3.0", "ACTIVE",   3),
        (5, "DEV004", "IMEI10000000004", "v1.4.0", "INACTIVE", 2),
        (6, "DEV005", "IMEI10000000005", "v1.5.0", "ACTIVE",   4),
    ]
    df = pd.DataFrame(data, columns=[
        "DEVICE_ID", "DEVICE_CODE", "DEVICE_IMEI", "FIRMWARE_VERSION", "STATUS", "BRANCH_ID"
    ])

    with ENGINE.begin() as conn:
        for _, r in df.iterrows():
            conn.execute(text("""
                INSERT INTO IOT_DEVICES (DEVICE_ID, DEVICE_CODE, DEVICE_IMEI, FIRMWARE_VERSION, STATUS, BRANCH_ID)
                VALUES (:id, :code, :imei, :fw, :status, :bid)
            """), {
                "id": int(r["DEVICE_ID"]),
                "code": r["DEVICE_CODE"],
                "imei": r["DEVICE_IMEI"],
                "fw": r["FIRMWARE_VERSION"],
                "status": r["STATUS"],
                "bid": int(r["BRANCH_ID"]),
            })

    print("✅ Seeded IOT_DEVICES (exact 5 rows)")


def seed_managers() -> None:
    data = [
        # MANAGER_ID, MANAGER_CODE, FIRST_NAME, LAST_NAME, EMAIL, PHONE, MANAGER_PASSWORD, ROLE, BRANCH_ID
        (1, "SUP001", "Hamza", "Bjibji", "hamzabjibji@gmail.com", "+212636376992", "admincode123",
         "SUPERVISOR", None),

        (2, "MGR101", "Amina", "Berrada", "amina.berrada@carrental.ma", "+212600100101",
         "$2b$10$55HirCWqJPHfR9B.mbqA3e5mWMyRpEDg8ecAQWvWs.T.0U697dghq", "MANAGER", 1),

        (3, "MGR201", "Yassin", "El Idrissi", "yassin.elidrissi@carrental.ma", "+212600200201",
         "$2b$10$wxFyjVkqPD0Pqh.CbizD0u5BudD892m8/eFwoJNjDEjTGmZUtU0Zm", "MANAGER", 2),

        (4, "MGR301", "Nadia", "Zerouali", "nadia.zerouali@carrental.ma", "+212600300301",
         "$2b$10$4bhMdVW7KENJl1Kglkc2L.dWOQLL0Wndgf3kH/uT6CdiZEmXGK5lW", "MANAGER", 3),

        (5, "MGR401", "Soukaina", "Benali", "soukaina.benali@carrental.ma", "+212600400401",
         "$2b$10$9NZUt8WdxJ2Uk1YQNDSU9OLeVMw9j.0/TUQeuchLHOVTvh0qNGH8G", "MANAGER", 4),

        (6, "MGR501", "Sara", "El Fassi", "sara.elfassi@carrental.ma", "+212600500501",
         "$2b$10$TLBe0pFuHmcx7Fmp.TAnbOPgv5HqJ7ZAGH3Hcs1AAm3Qd911LUfJC", "MANAGER", 5),
    ]

    with ENGINE.begin() as conn:
        for r in data:
            conn.execute(text("""
                INSERT INTO MANAGERS (
                    MANAGER_ID, MANAGER_CODE, FIRST_NAME, LAST_NAME, EMAIL, PHONE,
                    MANAGER_PASSWORD, ROLE, BRANCH_ID
                ) VALUES (
                    :id, :code, :fn, :ln, :email, :phone,
                    :pwd, :role, :bid
                )
            """), {
                "id": int(r[0]),
                "code": r[1],
                "fn": r[2],
                "ln": r[3],
                "email": r[4],
                "phone": r[5],
                "pwd": r[6],
                "role": r[7],
                "bid": r[8],
            })

    print("✅ Seeded MANAGERS (exact 6 rows)")


def seed_cars() -> None:
    data = [
        # CAR_ID, CATEGORY_ID, DEVICE_ID, VIN, LICENSE_PLATE, MAKE, MODEL, MODEL_YEAR, COLOR, IMAGE_URL, ODOMETER_KM, STATUS, BRANCH_ID
        (1, 1, 2, "VIN000000001", "1363-B-6",  "Dacia",   "Sandero", 2022, "White",
         "https://m.atcdn.co.uk/a/media/w480/ed12c67aae694a40a7831d457f3bea91.jpg", 12000, "AVAILABLE", 1),

        (2, 2, 1, "VIN000000006", "1548-A-2",  "BMW",     "530i",    2021, "Black",
         "https://i.ytimg.com/vi/B0-z8LCf6-0/maxresdefault.jpg", 41000, "AVAILABLE", 5),

        (3, 3, 4, "VIN000000012", "1548-C-3",  "Tesla",   "Model 3", 2023, "White",
         "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Tesla_Model_3_%282023%29%2C_long_range%2C_Japan%2C_left-front.jpg/2560px-Tesla_Model_3_%282023%29%2C_long_range%2C_Japan%2C_left-front.jpg", 7000, "AVAILABLE", 3),

        (4, 4, 6, "VIN000000057", "5687-B-78", "Hyundai", "i10",     2023, "Gris",
         "https://www.larevueautomobile.com/images/fiche-technique/2023/Hyundai/i10/Hyundai_i10_MD_3.webp", 6400, "AVAILABLE", 4),
    ]

    with ENGINE.begin() as conn:
        for r in data:
            conn.execute(text("""
                INSERT INTO CARS (
                    CAR_ID, CATEGORY_ID, DEVICE_ID, VIN, LICENSE_PLATE, MAKE, MODEL,
                    MODEL_YEAR, COLOR, IMAGE_URL, ODOMETER_KM, STATUS, BRANCH_ID
                ) VALUES (
                    :id, :cat, :dev, :vin, :plate, :make, :model,
                    :year, :color, :img, :odo, :status, :bid
                )
            """), {
                "id": int(r[0]),
                "cat": int(r[1]),
                "dev": int(r[2]) if r[2] is not None else None,
                "vin": r[3],
                "plate": r[4],
                "make": r[5],
                "model": r[6],
                "year": int(r[7]),
                "color": r[8],
                "img": r[9],
                "odo": int(r[10]),
                "status": r[11],
                "bid": int(r[12]) if r[12] is not None else None,
            })

    print("✅ Seeded CARS (exact 4 rows)")


# =============================================================================
# MAIN
# =============================================================================

def main() -> None:
    print("🔌 Connected to Oracle.")
    wipe_all()

    # Seed in parent-first order
    seed_branches()
    seed_categories()
    seed_devices()
    seed_managers()
    seed_cars()

    print("🎉 Done. Seeded EXACT dataset only (no customers).")


if __name__ == "__main__":
    main()
