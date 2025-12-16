from __future__ import annotations

import json
import bcrypt
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

SEED_JSON_PATH = "seed_data.json"

# IMPORTANT: delete children first, parents last
WIPE_ORDER = [
    "RT_IOT_FEED",
    "IOT_TELEMETRY",
    "RENTALS",
    "IOT_ALERTS",
    "CARS",
    "CUSTOMERS",
    "IOT_DEVICES",
    "CAR_CATEGORIES",
    "MANAGERS",
    "BRANCHES",
]

PLAIN_PASSWORD = "admincode123"
BCRYPT_ROUNDS = 12

# =============================================================================
# UTILITIES
# =============================================================================

def load_seed() -> dict:
    with open(SEED_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def delete_table(conn, table: str) -> None:
    try:
        n = conn.execute(text(f"DELETE FROM {table}")).rowcount
        print(f"🧽 DELETE {table}: {n} rows")
    except Exception as e:
        print(f"⚠️ DELETE {table} failed: {e}")

def reset_identity_for_table(conn, table: str) -> None:
    """Best-effort identity reset (Oracle XE may reject)."""
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

        conn.execute(text(f"""
            ALTER TABLE {table}
            MODIFY ({col} GENERATED ALWAYS AS IDENTITY (START WITH 1))
        """))
        print(f"🔁 Reset identity {table}.{col} START WITH 1")
    except Exception:
        pass

def wipe_all() -> None:
    with ENGINE.begin() as conn:
        for t in WIPE_ORDER:
            delete_table(conn, t)

        for t in ["BRANCHES", "MANAGERS", "CAR_CATEGORIES", "IOT_DEVICES", "CARS", "CUSTOMERS"]:
            reset_identity_for_table(conn, t)

    print("✅ Database wiped.")

def bcrypt_hash(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode("utf-8")

def fetch_rows(conn, sql: str, params: dict | None = None) -> list[dict]:
    df = pd.read_sql(text(sql), conn, params=params or {})
    if df.empty:
        return []
    df.columns = [c.upper().strip() for c in df.columns]
    return df.to_dict(orient="records")

# =============================================================================
# SEED FROM JSON
# =============================================================================

def seed_from_json(seed: dict) -> None:
    with ENGINE.begin() as conn:
        # 1) BRANCHES
        for b in seed["branches"]:
            conn.execute(text("""
                INSERT INTO BRANCHES (BRANCH_NAME, ADDRESS, CITY, PHONE, EMAIL)
                VALUES (:name, :addr, :city, :phone, :email)
            """), {
                "name": b["branch_name"],
                "addr": b["address"],
                "city": b["city"],
                "phone": b["phone"],
                "email": b["email"],
            })
        print(f"✅ Seeded BRANCHES ({len(seed['branches'])})")

        # branch_city -> branch_id
        branch_map = {
            str(r["CITY"]).strip().lower(): int(r["BRANCH_ID"])
            for r in fetch_rows(conn, "SELECT BRANCH_ID, CITY FROM BRANCHES")
        }

        # 2) CAR_CATEGORIES
        for c in seed["categories"]:
            conn.execute(text("""
                INSERT INTO CAR_CATEGORIES (CATEGORY_NAME, DESCRIPTION)
                VALUES (:name, :desc)
            """), {"name": c["category_name"], "desc": c["description"]})
        print(f"✅ Seeded CAR_CATEGORIES ({len(seed['categories'])})")

        # category_name -> category_id
        cat_map = {
            str(r["CATEGORY_NAME"]).strip().lower(): int(r["CATEGORY_ID"])
            for r in fetch_rows(conn, "SELECT CATEGORY_ID, CATEGORY_NAME FROM CAR_CATEGORIES")
        }

        # 3) IOT_DEVICES
        for d in seed["iot_devices"]:
            city = str(d["branch_city"]).strip().lower()
            bid = branch_map[city]
            conn.execute(text("""
                INSERT INTO IOT_DEVICES (DEVICE_CODE, DEVICE_IMEI, FIRMWARE_VERSION, STATUS, BRANCH_ID)
                VALUES (:code, :imei, :fw, :status, :bid)
            """), {
                "code": d["device_code"],
                "imei": d["device_imei"],
                "fw": d["firmware_version"],
                "status": d.get("status", "INACTIVE"),
                "bid": bid,
            })
        print(f"✅ Seeded IOT_DEVICES ({len(seed['iot_devices'])})")

        # device_code -> device_id
        dev_map = {
            str(r["DEVICE_CODE"]).strip().upper(): int(r["DEVICE_ID"])
            for r in fetch_rows(conn, "SELECT DEVICE_ID, DEVICE_CODE FROM IOT_DEVICES")
        }

        # 4) MANAGERS (hash password here)
        pwd_hash = bcrypt_hash(PLAIN_PASSWORD)
        for m in seed["managers"]:
            bid = None
            if m.get("branch_city"):
                bid = branch_map[str(m["branch_city"]).strip().lower()]

            conn.execute(text("""
                INSERT INTO MANAGERS (
                  MANAGER_CODE, FIRST_NAME, LAST_NAME, EMAIL, PHONE,
                  MANAGER_PASSWORD, ROLE, BRANCH_ID
                ) VALUES (
                  :code, :fn, :ln, :email, :phone,
                  :pwd, :role, :bid
                )
            """), {
                "code": m["manager_code"],
                "fn": m["first_name"],
                "ln": m["last_name"],
                "email": m["email"],
                "phone": m["phone"],
                "pwd": pwd_hash,
                "role": m["role"],
                "bid": bid,
            })
        print(f"✅ Seeded MANAGERS ({len(seed['managers'])}) (password bcrypt('{PLAIN_PASSWORD}'))")

        # manager_code -> manager_id
        mgr_map = {
            str(r["MANAGER_CODE"]).strip().upper(): int(r["MANAGER_ID"])
            for r in fetch_rows(conn, "SELECT MANAGER_ID, MANAGER_CODE FROM MANAGERS")
        }

        # 5) CARS
        for car in seed["cars"]:
            bid = branch_map[str(car["branch_city"]).strip().lower()]
            cat_id = cat_map[str(car["category_name"]).strip().lower()]
            dev_id = dev_map[str(car["device_code"]).strip().upper()]

            conn.execute(text("""
                INSERT INTO CARS (
                    CATEGORY_ID, DEVICE_ID, VIN, LICENSE_PLATE, MAKE, MODEL,
                    MODEL_YEAR, COLOR, IMAGE_URL, ODOMETER_KM, STATUS, BRANCH_ID
                ) VALUES (
                    :cat, :dev, :vin, :plate, :make, :model,
                    :year, :color, :img, :odo, :status, :bid
                )
            """), {
                "cat": cat_id,
                "dev": dev_id,
                "vin": car["vin"],
                "plate": car["license_plate"],
                "make": car["make"],
                "model": car["model"],
                "year": int(car["model_year"]),
                "color": car["color"],
                "img": car.get("image_url"),
                "odo": int(car["odometer_km"]),
                "status": car.get("status", "AVAILABLE"),
                "bid": bid,
            })

        # Mark devices assigned to cars as ACTIVE
        conn.execute(text("""
            UPDATE IOT_DEVICES d
               SET d.STATUS='ACTIVE',
                   d.ACTIVATED_AT = NVL(d.ACTIVATED_AT, SYSTIMESTAMP)
             WHERE EXISTS (
               SELECT 1 FROM CARS c WHERE c.DEVICE_ID = d.DEVICE_ID
             )
        """))

        print(f"✅ Seeded CARS ({len(seed['cars'])}) + marked assigned IOT_DEVICES ACTIVE")

        # 6) CUSTOMERS
        for cust in seed["customers"]:
            bid = branch_map[str(cust["branch_city"]).strip().lower()]
            mid = mgr_map[str(cust["manager_code"]).strip().upper()]

            conn.execute(text("""
                INSERT INTO CUSTOMERS (
                  BRANCH_ID, MANAGER_ID,
                  FIRST_NAME, LAST_NAME,
                  NATIONAL_ID, DATE_OF_BIRTH,
                  DRIVER_LICENSE_NO,
                  EMAIL, PHONE
                ) VALUES (
                  :bid, :mid,
                  :fn, :ln,
                  :nid, TO_DATE(:dob, 'YYYY-MM-DD'),
                  :lic,
                  :email, :phone
                )
            """), {
                "bid": bid,
                "mid": mid,
                "fn": cust["first_name"],
                "ln": cust["last_name"],
                "nid": cust["national_id"],
                "dob": cust["date_of_birth"],
                "lic": cust["driver_license_no"],
                "email": cust["email"],
                "phone": cust["phone"],
            })

        print(f"✅ Seeded CUSTOMERS ({len(seed['customers'])})")

# =============================================================================
# MAIN
# =============================================================================

def main() -> None:
    print("🔌 Connected to Oracle.")
    seed = load_seed()

    wipe_all()
    seed_from_json(seed)

    print("🎉 Done.")
    print(f"🔐 All manager passwords are bcrypt('{PLAIN_PASSWORD}').")

if __name__ == "__main__":
    main()
