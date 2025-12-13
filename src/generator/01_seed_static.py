"""
Database seeding script (Oracle).
- Wipes tables in dependency-safe order
- Resets identity sequences (best effort)
- Seeds: branches, managers, categories, iot devices, cars, customers

Run:
  python seed_db.py
"""

from __future__ import annotations

import time
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

TRUNCATE_ORDER = [
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

# Toggle this to True only if you actually have car_image_query/wiki_page_image implemented
ENABLE_CAR_IMAGES = False


# =============================================================================
# DB UTILITIES
# =============================================================================

def try_truncate_or_delete(conn, table: str) -> None:
    """Try TRUNCATE; fallback to DELETE if TRUNCATE fails."""
    try:
        conn.execute(text(f"TRUNCATE TABLE {table}"))
        print(f"🧹 TRUNCATE {table}")
    except Exception as e:
        print(f"⚠️ TRUNCATE {table} failed → {e}; trying DELETE ...")
        deleted = conn.execute(text(f"DELETE FROM {table}")).rowcount
        print(f"🧽 DELETE {table}: {deleted} rows")


def restart_identities(conn) -> None:
    """Reset identity sequences (best effort across Oracle setups)."""
    seq_names: list[str] = []

    # 1) Identity metadata (if accessible)
    try:
        rows = pd.read_sql(text("SELECT * FROM USER_TAB_IDENTITY_COLS"), conn)
        if not rows.empty:
            rows.columns = [c.upper().strip() for c in rows.columns]
            if "SEQUENCE_NAME" in rows.columns:
                seq_names = rows["SEQUENCE_NAME"].dropna().astype(str).tolist()
    except Exception:
        pass

    # 2) Oracle internal identity sequences pattern
    if not seq_names:
        try:
            idseqs = pd.read_sql(
                text("SELECT SEQUENCE_NAME FROM USER_SEQUENCES WHERE SEQUENCE_NAME LIKE 'ISEQ$$_%'"),
                conn,
            )
            if not idseqs.empty:
                idseqs.columns = [c.upper().strip() for c in idseqs.columns]
                seq_names = idseqs["SEQUENCE_NAME"].astype(str).tolist()
        except Exception:
            pass

    # 3) All sequences fallback
    if not seq_names:
        try:
            allseqs = pd.read_sql(text("SELECT SEQUENCE_NAME FROM USER_SEQUENCES"), conn)
            if not allseqs.empty:
                allseqs.columns = [c.upper().strip() for c in allseqs.columns]
                seq_names = allseqs["SEQUENCE_NAME"].astype(str).tolist()
        except Exception:
            pass

    if not seq_names:
        print("ℹ️ No sequences found to reset.")
        return

    for seq in seq_names:
        try:
            conn.execute(text(f"ALTER SEQUENCE {seq} RESTART START WITH 1"))
            print(f"🔁 RESET sequence {seq} → 1")
        except Exception as e:
            # Some Oracle versions won’t allow RESTART; keep best-effort behavior
            print(f"⚠️ Could not reset {seq}: {e}")


def wipe_all_data() -> None:
    """Wipe data in dependency order and attempt to reset sequences."""
    with ENGINE.begin() as conn:
        for t in TRUNCATE_ORDER:
            try_truncate_or_delete(conn, t)
        restart_identities(conn)
    print("🧨 Database wiped.")


def map_table(conn, sql: str, key_col: str, val_col: str) -> dict[str, int]:
    """Execute SQL and return {key -> id} mapping with column name normalization."""
    t = pd.read_sql(text(sql), conn)
    if t.empty:
        return {}

    t.columns = [c.upper().strip() for c in t.columns]
    key = key_col.upper().strip()
    val = val_col.upper().strip()

    if key not in t.columns or val not in t.columns:
        print(f"⚠️ map_table missing cols. Have={list(t.columns)} key={key} val={val}")
        return {}

    return dict(
        zip(
            t[key].astype(str),
            pd.to_numeric(t[val], errors="raise").astype(int),
        )
    )


def get_iot_device_pk_name(conn) -> str:
    """Detect identity/PK column for IOT_DEVICES. Fallback 'DEVICE_ID'."""
    try:
        idx = pd.read_sql(
            text("SELECT COLUMN_NAME FROM USER_TAB_IDENTITY_COLS WHERE TABLE_NAME = 'IOT_DEVICES'"),
            conn,
        )
        if not idx.empty:
            idx.columns = [c.upper().strip() for c in idx.columns]
            col = str(idx.iloc[0].get("COLUMN_NAME", idx.iloc[0][idx.columns[0]])).strip()
            print(f"ℹ️ Identity column for IOT_DEVICES = {col}")
            return col
    except Exception as e:
        print(f"ℹ️ USER_TAB_IDENTITY_COLS not accessible: {e}")

    cols = pd.read_sql(
        text("SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'IOT_DEVICES'"),
        conn,
    )
    if cols.empty:
        print("⚠️ No columns for IOT_DEVICES; fallback DEVICE_ID")
        return "DEVICE_ID"

    cols.columns = [c.upper().strip() for c in cols.columns]
    names = [str(c).upper().strip() for c in cols["COLUMN_NAME"].tolist()]

    if "DEVICE_ID" in names:
        return "DEVICE_ID"

    return names[0]


def fetch_free_device_ids(conn, pk: str) -> list[int]:
    """IDs of INACTIVE devices not linked to any car."""
    q = f"""
        SELECT d.{pk} AS DEVICE_PK
        FROM IOT_DEVICES d
        LEFT JOIN CARS c ON c.DEVICE_ID = d.{pk}
        WHERE d.STATUS = 'INACTIVE' AND c.DEVICE_ID IS NULL
        ORDER BY d.{pk}
    """
    t = pd.read_sql(text(q), conn)
    if t.empty:
        return []

    t.columns = [c.upper().strip() for c in t.columns]
    if "DEVICE_PK" not in t.columns:
        print(f"⚠️ fetch_free_device_ids missing DEVICE_PK. Have={list(t.columns)}")
        return []

    return pd.to_numeric(t["DEVICE_PK"], errors="coerce").dropna().astype(int).tolist()


# =============================================================================
# SEEDERS
# =============================================================================

def seed_branches() -> None:
    data = [
        ("Casablanca HQ", "Bd Al Massira, Maarif", "Casablanca", "+212522000111", "casa.hq@carrental.ma"),
        ("Rabat Agdal", "Av. de France, Agdal", "Rabat", "+212537000222", "rabat.agdal@carrental.ma"),
        ("Marrakech Gueliz", "Av. Mohammed V, Gueliz", "Marrakech", "+212524000333", "marrakech.gueliz@carrental.ma"),
        ("Tanger Downtown", "Rue de la Liberté, Centre-ville", "Tanger", "+212539000444", "tanger.dt@carrental.ma"),
        ("Agadir Plage", "Corniche, Plage", "Agadir", "+212602555666", "agadir.plage@carrental.ma"),
    ]
    df = pd.DataFrame(data, columns=["BRANCH_NAME", "ADDRESS", "CITY", "PHONE", "EMAIL"])

    with ENGINE.begin() as conn:
        df.to_sql("BRANCHES", conn, if_exists="append", index=False)

    print("✅ Inserted branches")


def seed_managers() -> None:
    rows = [
        ("SUP001", "Hamza", "Bjibji", "hamza.supervisor@carrental.local", "+212600000000", "Admin#123", "SUPERVISOR", None),

        ("MGR101", "Amina", "Berrada", "amina.berrada@carrental.ma", "+212600100101", "pwd#Casa1", "MANAGER", "Casablanca HQ"),
        ("MGR102", "Karim", "Saidi", "karim.saidi@carrental.ma", "+212600100102", "pwd#Casa2", "MANAGER", "Casablanca HQ"),
        ("MGR201", "Yassin", "El Idrissi", "yassin.elidrissi@carrental.ma", "+212600200201", "pwd#Rabat1", "MANAGER", "Rabat Agdal"),
        ("MGR202", "Lina", "Mouline", "lina.mouline@carrental.ma", "+212600200202", "pwd#Rabat2", "MANAGER", "Rabat Agdal"),
        ("MGR301", "Nadia", "Zerouali", "nadia.zerouali@carrental.ma", "+212600300301", "pwd#Mrk1", "MANAGER", "Marrakech Gueliz"),
        ("MGR302", "Omar", "Kabbaj", "omar.kabbaj@carrental.ma", "+212600300302", "pwd#Mrk2", "MANAGER", "Marrakech Gueliz"),
        ("MGR401", "Soukaina", "Benali", "soukaina.benali@carrental.ma", "+212600400401", "pwd#Tgr1", "MANAGER", "Tanger Downtown"),
        ("MGR402", "Hicham", "Alaoui", "hicham.alaoui@carrental.ma", "+212600400402", "pwd#Tgr2", "MANAGER", "Tanger Downtown"),
        ("MGR501", "Sara", "El Fassi", "sara.elfassi@carrental.ma", "+212600500501", "pwd#Agd1", "MANAGER", "Agadir Plage"),
        ("MGR502", "Youssef", "Boukhriss", "youssef.boukhriss@carrental.ma", "+212600500502", "pwd#Agd2", "MANAGER", "Agadir Plage"),
    ]

    df = pd.DataFrame(
        rows,
        columns=["MANAGER_CODE", "FIRST_NAME", "LAST_NAME", "EMAIL", "PHONE",
                 "MANAGER_PASSWORD", "ROLE", "BRANCH_NAME"],
    )

    with ENGINE.begin() as conn:
        bmap = map_table(conn, "SELECT BRANCH_ID, BRANCH_NAME FROM BRANCHES", "BRANCH_NAME", "BRANCH_ID")

        def branch_to_id(row):
            if str(row["ROLE"]).upper() == "SUPERVISOR":
                return None
            return bmap.get(str(row["BRANCH_NAME"]))

        df["BRANCH_ID"] = df.apply(branch_to_id, axis=1)

        bad = df[(df["ROLE"].str.upper() == "MANAGER") & (df["BRANCH_ID"].isna())]
        if not bad.empty:
            raise RuntimeError(f"Managers with missing branch mapping: {bad[['EMAIL','BRANCH_NAME']].to_dict('records')}")

        ins = df[["MANAGER_CODE", "FIRST_NAME", "LAST_NAME", "EMAIL", "PHONE",
                 "MANAGER_PASSWORD", "ROLE", "BRANCH_ID"]]

        ins.to_sql("MANAGERS", conn, if_exists="append", index=False)

    print(f"✅ Inserted {len(df)} managers (including supervisor)")


def seed_categories() -> None:
    rows = [
        ("Economy", "Small city cars; fuel-efficient"),
        ("SUV", "Sport Utility Vehicles"),
        ("Luxury", "Premium sedans/coupes"),
        ("Van", "7–9 seat vehicles"),
        ("Electric", "Fully electric; zero emissions"),
    ]
    df = pd.DataFrame(rows, columns=["CATEGORY_NAME", "DESCRIPTION"])

    with ENGINE.begin() as conn:
        df.to_sql("CAR_CATEGORIES", conn, if_exists="append", index=False)

    print("✅ Inserted categories")


def seed_iot_devices() -> None:
    rows = [
        (f"DEV{str(i).zfill(3)}", f"IMEI10000000{str(i).zfill(3)}", f"v{1 + i//10}.{i%10}.0")
        for i in range(1, 51)
    ]
    df = pd.DataFrame(rows, columns=["DEVICE_CODE", "DEVICE_IMEI", "FIRMWARE_VERSION"])
    df["STATUS"] = "INACTIVE"
    df["ACTIVATED_AT"] = None
    df["LAST_SEEN_AT"] = None

    with ENGINE.begin() as conn:
        df.to_sql("IOT_DEVICES", conn, if_exists="append", index=False)

    print("✅ Inserted IoT devices")


def seed_cars() -> None:
    rows = [
        # CATEGORY_NAME, VIN, LICENSE_PLATE, MAKE, MODEL, MODEL_YEAR, COLOR, ODOMETER_KM, STATUS, BRANCH_NAME
        ("Economy","VIN000000001","A-101-CN","Dacia","Sandero",2022,"White",12000,"AVAILABLE","Casablanca HQ"),
        ("Economy","VIN000000002","A-102-CN","Toyota","Yaris",2021,"Blue",23000,"AVAILABLE","Casablanca HQ"),
        ("Economy","VIN000000003","A-103-CN","Kia","Picanto",2023,"Red",8000,"AVAILABLE","Casablanca HQ"),
        ("SUV","VIN000000004","A-104-SV","Hyundai","Tucson",2023,"Gray",9000,"AVAILABLE","Casablanca HQ"),
        ("SUV","VIN000000005","A-105-SV","Nissan","Qashqai",2022,"Silver",11000,"AVAILABLE","Casablanca HQ"),
        ("Luxury","VIN000000006","A-106-LX","BMW","530i",2021,"Black",41000,"AVAILABLE","Casablanca HQ"),
        ("Luxury","VIN000000007","A-107-LX","Audi","A6",2022,"White",37000,"AVAILABLE","Casablanca HQ"),
        ("Van","VIN000000008","A-108-VN","Renault","Trafic",2020,"Gray",60000,"AVAILABLE","Casablanca HQ"),
        ("Van","VIN000000009","A-109-VN","Ford","Tourneo",2021,"Blue",52000,"AVAILABLE","Casablanca HQ"),
        ("Electric","VIN000000010","A-110-EV","Renault","Zoe",2022,"Green",9500,"AVAILABLE","Casablanca HQ"),
        ("Electric","VIN000000011","A-111-EV","Peugeot","e-208",2023,"Yellow",4000,"AVAILABLE","Casablanca HQ"),
        ("Electric","VIN000000012","A-112-EV","Tesla","Model 3",2023,"White",7000,"AVAILABLE","Casablanca HQ"),
        ("Economy","VIN000000013","A-113-CN","Fiat","Panda",2021,"Red",17000,"AVAILABLE","Casablanca HQ"),
        ("SUV","VIN000000014","A-114-SV","Dacia","Duster",2022,"Orange",21000,"AVAILABLE","Casablanca HQ"),
        ("Luxury","VIN000000015","A-115-LX","Mercedes","E200",2021,"Black",36000,"AVAILABLE","Casablanca HQ"),

        ("Economy","VIN000000016","B-201-CN","Toyota","Yaris",2022,"Gray",19000,"AVAILABLE","Rabat Agdal"),
        ("Economy","VIN000000017","B-202-CN","Hyundai","i10",2023,"Blue",8000,"AVAILABLE","Rabat Agdal"),
        ("SUV","VIN000000018","B-203-SV","Kia","Sportage",2022,"Black",15000,"AVAILABLE","Rabat Agdal"),
        ("SUV","VIN000000019","B-204-SV","Volkswagen","T-Roc",2021,"White",21000,"AVAILABLE","Rabat Agdal"),
        ("Luxury","VIN000000020","B-205-LX","BMW","320i",2022,"Blue",28000,"AVAILABLE","Rabat Agdal"),
        ("Luxury","VIN000000021","B-206-LX","Audi","A4",2023,"Silver",19000,"AVAILABLE","Rabat Agdal"),
        ("Van","VIN000000022","B-207-VN","Ford","Transit",2020,"White",65000,"AVAILABLE","Rabat Agdal"),
        ("Van","VIN000000023","B-208-VN","Mercedes","Vito",2021,"Gray",52000,"AVAILABLE","Rabat Agdal"),
        ("Electric","VIN000000024","B-209-EV","Nissan","Leaf",2022,"Green",10000,"AVAILABLE","Rabat Agdal"),
        ("Electric","VIN000000025","B-210-EV","Peugeot","e-2008",2023,"Black",6000,"AVAILABLE","Rabat Agdal"),

        ("Economy","VIN000000026","C-301-CN","Renault","Clio",2021,"Gray",22000,"AVAILABLE","Marrakech Gueliz"),
        ("SUV","VIN000000027","C-302-SV","Jeep","Compass",2022,"Red",17000,"AVAILABLE","Marrakech Gueliz"),
        ("SUV","VIN000000028","C-303-SV","Hyundai","Kona",2023,"Silver",9000,"AVAILABLE","Marrakech Gueliz"),
        ("Luxury","VIN000000029","C-304-LX","Mercedes","C-Class",2021,"Black",39000,"AVAILABLE","Marrakech Gueliz"),
        ("Luxury","VIN000000030","C-305-LX","BMW","X3",2022,"White",31000,"AVAILABLE","Marrakech Gueliz"),
        ("Van","VIN000000031","C-306-VN","Fiat","Ducato",2020,"White",72000,"AVAILABLE","Marrakech Gueliz"),
        ("Van","VIN000000032","C-307-VN","Peugeot","Expert",2021,"Gray",54000,"AVAILABLE","Marrakech Gueliz"),
        ("Electric","VIN000000033","C-308-EV","Tesla","Model Y",2023,"Blue",8000,"AVAILABLE","Marrakech Gueliz"),
        ("Electric","VIN000000034","C-309-EV","Renault","Megane E-Tech",2023,"Yellow",4000,"AVAILABLE","Marrakech Gueliz"),
        ("Economy","VIN000000035","C-310-CN","Suzuki","Swift",2022,"Orange",15000,"AVAILABLE","Marrakech Gueliz"),

        ("Economy","VIN000000036","D-401-CN","Dacia","Logan",2020,"White",45000,"AVAILABLE","Tanger Downtown"),
        ("SUV","VIN000000037","D-402-SV","Toyota","RAV4",2021,"Black",23000,"AVAILABLE","Tanger Downtown"),
        ("SUV","VIN000000038","D-403-SV","Kia","Seltos",2023,"Gray",9000,"AVAILABLE","Tanger Downtown"),
        ("Luxury","VIN000000039","D-404-LX","Audi","A5",2022,"Blue",21000,"AVAILABLE","Tanger Downtown"),
        ("Luxury","VIN000000040","D-405-LX","BMW","X5",2023,"Silver",18000,"AVAILABLE","Tanger Downtown"),
        ("Van","VIN000000041","D-406-VN","Mercedes","Vito",2020,"White",71000,"AVAILABLE","Tanger Downtown"),
        ("Van","VIN000000042","D-407-VN","Ford","Transit",2021,"Blue",65000,"AVAILABLE","Tanger Downtown"),
        ("Electric","VIN000000043","D-408-EV","Nissan","Leaf",2022,"Green",12000,"AVAILABLE","Tanger Downtown"),
        ("Electric","VIN000000044","D-409-EV","Peugeot","e-208",2023,"Red",5000,"AVAILABLE","Tanger Downtown"),
        ("Economy","VIN000000045","D-410-CN","Toyota","Aygo",2021,"Orange",18000,"AVAILABLE","Tanger Downtown"),

        ("Economy","VIN000000046","E-501-CN","Hyundai","i20",2023,"White",9000,"AVAILABLE","Agadir Plage"),
        ("SUV","VIN000000047","E-502-SV","Nissan","Juke",2021,"Gray",25000,"AVAILABLE","Agadir Plage"),
        ("SUV","VIN000000048","E-503-SV","Kia","Seltos",2022,"Black",20000,"AVAILABLE","Agadir Plage"),
        ("Luxury","VIN000000049","E-504-LX","BMW","530e",2023,"Silver",12000,"AVAILABLE","Agadir Plage"),
        ("Luxury","VIN000000050","E-505-LX","Mercedes","C-Class",2022,"White",15000,"AVAILABLE","Agadir Plage"),
        ("Van","VIN000000051","E-506-VN","Peugeot","Traveller",2021,"Gray",61000,"AVAILABLE","Agadir Plage"),
        ("Van","VIN000000052","E-507-VN","Renault","Trafic",2020,"White",68000,"AVAILABLE","Agadir Plage"),
        ("Electric","VIN000000053","E-508-EV","Tesla","Model 3",2023,"Black",7000,"AVAILABLE","Agadir Plage"),
        ("Electric","VIN000000054","E-509-EV","Renault","Zoe",2022,"Blue",8000,"AVAILABLE","Agadir Plage"),
        ("Electric","VIN000000055","E-510-EV","Peugeot","e-208",2023,"Yellow",6000,"AVAILABLE","Agadir Plage"),
    ]

    df = pd.DataFrame(rows, columns=[
        "CATEGORY_NAME","VIN","LICENSE_PLATE","MAKE","MODEL","MODEL_YEAR",
        "COLOR","ODOMETER_KM","STATUS","BRANCH_NAME"
    ])

    with ENGINE.begin() as conn:
        cmap = map_table(conn, "SELECT CATEGORY_ID, CATEGORY_NAME FROM CAR_CATEGORIES", "CATEGORY_NAME", "CATEGORY_ID")
        bmap = map_table(conn, "SELECT BRANCH_ID, BRANCH_NAME FROM BRANCHES", "BRANCH_NAME", "BRANCH_ID")
        if not cmap:
            raise RuntimeError("⚠️ CAR_CATEGORIES empty. Seed categories first.")
        if not bmap:
            raise RuntimeError("⚠️ BRANCHES empty. Seed branches first.")

        device_pk = get_iot_device_pk_name(conn)
        free = fetch_free_device_ids(conn, device_pk)

        if len(free) < len(df):
            print(f"ℹ️ Only {len(free)} free INACTIVE devices for {len(df)} cars. Remaining DEVICE_ID will be NULL.")

        df["CATEGORY_ID"] = df["CATEGORY_NAME"].map(cmap)
        df["BRANCH_ID"]   = df["BRANCH_NAME"].map(bmap)
        df["DEVICE_ID"]   = [free.pop(0) if free else None for _ in range(len(df))]

        # Optional: images
        if ENABLE_CAR_IMAGES:
            image_urls = []
            for _, r in df.iterrows():
                make = str(r["MAKE"])
                model = str(r["MODEL"])
                url = None

                # You must provide these functions yourself
                for title in car_image_query(make, model):
                    url = wiki_page_image(title, thumb_px=900)
                    if url:
                        break
                image_urls.append(url)
                time.sleep(0.15)

            df["IMAGE_URL"] = image_urls
        else:
            df["IMAGE_URL"] = None

        ins = df[[
            "CATEGORY_ID",
            "DEVICE_ID",
            "VIN",
            "LICENSE_PLATE",
            "MAKE",
            "MODEL",
            "MODEL_YEAR",
            "COLOR",
            "IMAGE_URL",
            "ODOMETER_KM",
            "STATUS",
            "BRANCH_ID",
        ]]

        ins.to_sql("CARS", conn, if_exists="append", index=False)

        # mark assigned devices ACTIVE
        assigned_ids = [int(x) for x in ins["DEVICE_ID"].dropna().unique().tolist()]
        if assigned_ids:
            id_list = ", ".join(map(str, assigned_ids))
            conn.execute(text(f"""
                UPDATE IOT_DEVICES
                   SET STATUS = 'ACTIVE',
                       ACTIVATED_AT = NVL(ACTIVATED_AT, SYSTIMESTAMP)
                 WHERE {device_pk} IN ({id_list})
            """))

    print("✅ Inserted cars (device assignment + image URLs best effort).")


def seed_customers() -> None:
    first_names = [
        "Mohamed", "Fatima", "Youssef", "Khadija", "Ahmed", "Amina", "Omar", "Zineb",
        "Ali", "Mariam", "Hassan", "Sara", "Khalid", "Latifa", "Said", "Noura",
        "Brahim", "Salma", "Rachid", "Houda", "Yassine", "Imane", "Tarik", "Asmaa",
        "Mustapha", "Hanane", "Abdellah", "Karima", "Hamza", "Bouchra", "Driss", "Samira",
        "Adil", "Souad", "Zakaria", "Fatiha", "Mehdi", "Nadia", "Jamal", "Hasna",
        "Hicham", "Meryem", "Reda", "Hakima", "Bilal", "Sanae", "Anass", "Loubna",
        "Karim", "Wafaa",
    ]

    last_names = [
        "Alaoui", "Idrissi", "Tazi", "Berrada", "Bennani", "Fassi", "Chraibi", "Mernissi",
        "Amrani", "Benjelloun", "Ouazzani", "Ziani", "El Fassi", "El Amrani", "El Idrissi",
        "El Hachimi", "El Mansouri", "El Ouali", "El Baz", "El Khattabi", "Benali", "Boukhriss",
        "Daoudi", "Ghazouani", "Hamdaoui", "Jebbar", "Kabbaj", "Lahlou", "Malki", "Naciri",
        "Raji", "Sefiani", "Tahiri", "Wahbi", "Yacoubi", "Zerouali", "Ait Benhaddou", "Ait Oumghar",
        "Belkadi", "Cherkaoui", "Dahbi", "Es-Saadi", "Farès", "Guedira", "Hassar", "Ibrahimi",
        "Jettou", "Kadiri", "Laraichi", "Maâti",
    ]

    customers = []
    for i in range(50):
        fn = first_names[i % len(first_names)]
        ln = last_names[i % len(last_names)]
        email = f"{fn.lower()}.{ln.lower()}{i+1}@carrental.ma"
        phone = f"+2126{str(i).zfill(8)}"
        id_num = f"AB{100000 + i}"
        customers.append((fn, ln, email, phone, id_num))

    df = pd.DataFrame(customers, columns=["FIRST_NAME", "LAST_NAME", "EMAIL", "PHONE", "ID_NUMBER"])

    with ENGINE.begin() as conn:
        df.to_sql("CUSTOMERS", conn, if_exists="append", index=False)

    print(f"✅ Inserted {len(df)} customers")


# =============================================================================
# MAIN
# =============================================================================

def main() -> None:
    print("Connected to Oracle.")
    wipe_all_data()

    seed_branches()
    seed_managers()
    seed_iot_devices()
    seed_categories()
    seed_cars()
    seed_customers()

    print("🎉 Static seed completed (fresh database).")


if __name__ == "__main__":
    main()
