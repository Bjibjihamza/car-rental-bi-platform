"""
Oracle seed script (Oracle 21c XE compatible).
- Wipes tables in dependency-safe order
- Best-effort identity reset
- Seeds:
  * BRANCHES (5)
  * CAR_CATEGORIES (5)
  * IOT_DEVICES (~6/branch => 30)
  * MANAGERS (2/branch => 10) + SUPERVISOR (1)
  * CARS (7/branch => 35)
- Passwords: ALL are bcrypt("admincode123")

Run:
  python 01_seed_static.py
"""

from __future__ import annotations

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

PLAIN_PASSWORD = "admincode123"
BCRYPT_ROUNDS = 12

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
    Best-effort identity reset. Some Oracle setups may reject it; keep best-effort.
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

        for t in ["BRANCHES", "MANAGERS", "CAR_CATEGORIES", "IOT_DEVICES", "CARS"]:
            reset_identity_for_table(conn, t)

    print("✅ Database wiped.")


def bcrypt_hash(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode("utf-8")


def map_table(conn, sql: str, key_col: str, val_col: str) -> dict[str, int]:
    df = pd.read_sql(text(sql), conn)
    if df.empty:
        return {}
    df.columns = [c.upper().strip() for c in df.columns]
    k = key_col.upper().strip()
    v = val_col.upper().strip()
    return dict(zip(df[k].astype(str), df[v].astype(int)))


def fetch_pairs(conn, sql: str) -> list[dict]:
    df = pd.read_sql(text(sql), conn)
    if df.empty:
        return []
    df.columns = [c.upper().strip() for c in df.columns]
    return df.to_dict(orient="records")

# =============================================================================
# SEEDERS
# =============================================================================

def seed_branches() -> None:
    rows = [
        ("Carrental Executive", "Bd Al Massira, Maarif", "Casablanca", "+212522000111", "casa.hq@carrental.ma"),
        ("Carrental Prestige",  "Av. de France, Agdal",  "Rabat",      "+212537000222", "rabat.agdal@carrental.ma"),
        ("Carrental Signature", "Av. Mohammed V, Gueliz","Marrakech",  "+212524000333", "marrakech.gueliz@carrental.ma"),
        ("Carrental Select",    "Rue de la Liberté, Centre-ville", "Tanger", "+212539000444", "tanger.dt@carrental.ma"),
        ("Carrental Elite",     "Corniche, Plage", "Agadir", "+212602555666", "agadir.plage@carrental.ma"),
    ]

    with ENGINE.begin() as conn:
        for (name, addr, city, phone, email) in rows:
            conn.execute(text("""
                INSERT INTO BRANCHES (BRANCH_NAME, ADDRESS, CITY, PHONE, EMAIL)
                VALUES (:name, :addr, :city, :phone, :email)
            """), {"name": name, "addr": addr, "city": city, "phone": phone, "email": email})

    print("✅ Seeded BRANCHES (5)")


def seed_categories() -> None:
    rows = [
        ("Economy", "Small city cars; fuel-efficient"),
        ("SUV", "Sport Utility Vehicles"),
        ("Luxury", "Premium sedans/coupes"),
        ("Van", "7–9 seat vehicles"),
        ("Electric", "Fully electric; zero emissions"),
    ]

    with ENGINE.begin() as conn:
        for (name, desc) in rows:
            conn.execute(text("""
                INSERT INTO CAR_CATEGORIES (CATEGORY_NAME, DESCRIPTION)
                VALUES (:name, :desc)
            """), {"name": name, "desc": desc})

    print("✅ Seeded CAR_CATEGORIES (5)")


def seed_devices() -> None:
    """
    ~6 devices per branch => 30 devices total
    """
    with ENGINE.begin() as conn:
        branches = fetch_pairs(conn, "SELECT BRANCH_ID, BRANCH_NAME FROM BRANCHES ORDER BY BRANCH_ID")
        if not branches:
            raise RuntimeError("BRANCHES empty; seed_branches first.")

        device_num = 1
        for b in branches:
            bid = int(b["BRANCH_ID"])
            for _ in range(6):
                code = f"DEV{device_num:03d}"
                imei = f"IMEI1000000{device_num:05d}"
                fw = f"v1.{(device_num % 10)}.0"
                status = "INACTIVE"  # cars assignment will flip to ACTIVE

                conn.execute(text("""
                    INSERT INTO IOT_DEVICES (DEVICE_CODE, DEVICE_IMEI, FIRMWARE_VERSION, STATUS, BRANCH_ID)
                    VALUES (:code, :imei, :fw, :status, :bid)
                """), {"code": code, "imei": imei, "fw": fw, "status": status, "bid": bid})

                device_num += 1

    print("✅ Seeded IOT_DEVICES (30 ~6/branch)")


def seed_managers() -> None:
    """
    2 managers per branch => 10 + supervisor => 11 total
    ALL passwords = bcrypt(admincode123)
    """
    pwd_hash = bcrypt_hash(PLAIN_PASSWORD)

    # names pool just for nice realism
    name_pool = [
        ("Amina", "Berrada"),
        ("Karim", "Saidi"),
        ("Yassin", "El Idrissi"),
        ("Lina", "Mouline"),
        ("Nadia", "Zerouali"),
        ("Omar", "Kabbaj"),
        ("Soukaina", "Benali"),
        ("Hicham", "Alaoui"),
        ("Sara", "El Fassi"),
        ("Youssef", "Boukhriss"),
    ]

    with ENGINE.begin() as conn:
        branches = fetch_pairs(conn, "SELECT BRANCH_ID, BRANCH_NAME, CITY FROM BRANCHES ORDER BY BRANCH_ID")
        if not branches:
            raise RuntimeError("BRANCHES empty; seed_branches first.")

        # supervisor
        conn.execute(text("""
            INSERT INTO MANAGERS (
              MANAGER_CODE, FIRST_NAME, LAST_NAME, EMAIL, PHONE,
              MANAGER_PASSWORD, ROLE, BRANCH_ID
            ) VALUES (
              :code, :fn, :ln, :email, :phone,
              :pwd, :role, :bid
            )
        """), {
            "code": "SUP001",
            "fn": "Hamza",
            "ln": "Bjibji",
            "email": "hamzabjibji@gmail.com",
            "phone": "+212636376992",
            "pwd": pwd_hash,
            "role": "SUPERVISOR",
            "bid": None,
        })

        # 2 managers per branch
        i = 0
        for b in branches:
            bid = int(b["BRANCH_ID"])
            city = str(b["CITY"]).lower()

            for j in range(2):
                fn, ln = name_pool[i % len(name_pool)]
                code = f"MGR{bid}{j+1:02d}"           # ex: MGR101, MGR102 for branch 1
                email = f"{fn.lower()}.{ln.lower()}.{bid}{j+1}@{city}.carrental.ma"
                phone = f"+2126{bid}{j+1}00{(i+11):04d}"

                conn.execute(text("""
                    INSERT INTO MANAGERS (
                      MANAGER_CODE, FIRST_NAME, LAST_NAME, EMAIL, PHONE,
                      MANAGER_PASSWORD, ROLE, BRANCH_ID
                    ) VALUES (
                      :code, :fn, :ln, :email, :phone,
                      :pwd, :role, :bid
                    )
                """), {
                    "code": code,
                    "fn": fn,
                    "ln": ln,
                    "email": email,
                    "phone": phone,
                    "pwd": pwd_hash,
                    "role": "MANAGER",
                    "bid": bid,
                })
                i += 1

    print("✅ Seeded MANAGERS (11: supervisor + 2/branch, bcrypt)")
def seed_cars() -> None:
    # 14 cars (7 Casablanca=BRANCH_ID 1, 7 Rabat=BRANCH_ID 2)
    # NOTE: we do NOT insert CAR_ID (identity generated always)
    data = [
        # BRANCH_ID, CATEGORY_ID, DEVICE_ID, VIN, LICENSE_PLATE, MAKE, MODEL, MODEL_YEAR, COLOR, IMAGE_URL, ODOMETER_KM, STATUS

        # ======================
        # Casablanca (BRANCH_ID=1)
        # ======================
        (1, 1, 1,  "VIN-CASA-0001", "A-101-CN", "Dacia",   "Logan",     2021, "White",
         "https://voiturenetma.s3.amazonaws.com/uploads/picture/url/407/big_with_watermark_dacia-logan-casablanca-ad-dar-al-bayda-88.jpg",
         52000, "AVAILABLE"),

        (1, 1, 2,  "VIN-CASA-0002", "A-102-CN", "Renault", "Clio 5",    2024, "Gray",
         "https://0cd4706d-085c-470e-97c9-b10facf8e101.svc.edge.scw.cloud/photos/6923548c93366cc1b99703c1552cfa50/stock_1032/image_2558844_1.jpg",
         9000, "AVAILABLE"),

        (1, 1, 3,  "VIN-CASA-0003", "A-103-CN", "Hyundai", "i10",       2023, "Blue",
         "https://v3.moteur.ma/storage/media/images/specsheets/moteur.ma-hyundai-grandi10-433964_.png",
         18000, "AVAILABLE"),

        (1, 1, 4,  "VIN-CASA-0004", "A-104-CN", "Peugeot", "301",       2020, "White",
         "https://www.wandaloo.com/files/Voiture-Occasion/2024/04/662969d9a4415.jpg",
         64000, "AVAILABLE"),

        (1, 4, 5,  "VIN-CASA-0005", "A-105-SV", "Dacia",   "Duster",    2022, "Black",
         "https://content.avito.ma/classifieds/images/10137124723?t=images",
         35000, "AVAILABLE"),

        (1, 4, 6,  "VIN-CASA-0006", "A-106-SV", "Hyundai", "Tucson",    2023, "Dark Gray",
         "https://occasions.hyundai.fr/media/cache/resolve/vehicle_details_large_jpg/vehicles/1b/84/6206/65053f63bb429.jpg",
         24000, "AVAILABLE"),

        (1, 5, 7,  "VIN-CASA-0007", "A-107-VN", "Renault", "Kangoo",    2021, "White",
         "https://storage.googleapis.com/cdn-ex-nihilo-nov-19-fast/production/2023/01/WhatsApp-Image-2023-01-10-at-10.34.31-2-1.jpeg",
         78000, "AVAILABLE"),


        # =================
        # Rabat (BRANCH_ID=2)
        # =================
        (2, 1, 8,  "VIN-RAB-0008",  "B-201-CN", "Dacia",   "Logan",     2021, "Gray",
         "https://bestcarsud.com/wp-content/uploads/2018/08/Dacia-logan-Gris.webp",
         56000, "AVAILABLE"),

        (2, 1, 9,  "VIN-RAB-0009",  "B-202-CN", "Renault", "Clio 5",    2024, "Red",
         "https://images.garage-gros.com/md/n8p1v01nd-renault-clio-v-2024-essence-boite-manuelle-rouge-metal-2.webp",
         8500, "AVAILABLE"),

        (2, 1, 10, "VIN-RAB-0010",  "B-203-CN", "Hyundai", "i10",       2023, "White",
         "https://cloud.leparking.fr/2025/11/19/20/01/hyundai-i10-1-0-bianco_9471361418.jpg",
         21000, "AVAILABLE"),

        (2, 1, 11, "VIN-RAB-0011",  "B-204-CN", "Peugeot", "301",       2016, "Black",
         "https://cloud.leparking.fr/2025/09/21/11/03/peugeot-301-1-6-vti-2016-cr-1-maj-serv-kniha-tempomat-noir_9432338548.jpg",
         98000, "AVAILABLE"),

        (2, 4, 12, "VIN-RAB-0012",  "B-205-SV", "Dacia",   "Duster",    2022, "Gray",
         "https://api.retail-renault-group.fr/media/cache/csu_thumb_mobile/cdn/photos_rrg_hd/117/3273424_laxau.webp",
         33000, "AVAILABLE"),

        (2, 4, 13, "VIN-RAB-0013",  "B-206-SV", "Hyundai", "Tucson",    2023, "White",
         "https://static.oneclickdrive.com/car-for-rent/mobile/Hyundai_Tucson_2023_21793_21793_14761758766-4_small.jpg",
         27000, "AVAILABLE"),

        (2, 5, 14, "VIN-RAB-0014",  "B-207-VN", "Renault", "Kangoo",    2021, "Light Gray",
         "https://api.retail-renault-group.fr/media/cache/csu_thumb_mobile/cdn/photos_rrg_hd/117/3272874_gowxc.webp",
         72000, "AVAILABLE"),
    ]

    with ENGINE.begin() as conn:
        for r in data:
            conn.execute(text("""
                INSERT INTO CARS (
                    CATEGORY_ID, DEVICE_ID, VIN, LICENSE_PLATE, MAKE, MODEL,
                    MODEL_YEAR, COLOR, IMAGE_URL, ODOMETER_KM, STATUS, BRANCH_ID
                ) VALUES (
                    :cat, :dev, :vin, :plate, :make, :model,
                    :year, :color, :img, :odo, :status, :bid
                )
            """), {
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
                "bid": int(r[0]),
            })

    print("✅ Seeded CARS (Casablanca + Rabat) using provided IMAGE_URLs.")


# =============================================================================
# MAIN
# =============================================================================

def main() -> None:
    print("🔌 Connected to Oracle.")
    wipe_all()

    seed_branches()
    seed_categories()
    seed_devices()
    seed_managers()
    seed_cars()

    print("🎉 Done. Seeded: 5 branches, 5 categories, 30 devices, 11 managers, 35 cars.")
    print("🔐 All passwords are bcrypt('admincode123').")

if __name__ == "__main__":
    main()
