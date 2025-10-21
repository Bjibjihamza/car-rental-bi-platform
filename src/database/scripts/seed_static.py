# 01_seed_static.py
# -------------------------------------------------------------------
# Full static seed with hard reset, robust sequence reset, and seeding:
# - Wipes all business tables (children -> parents)
# - Resets Oracle identity/classic sequences (XE-safe)
# - Seeds BRANCHES, MANAGERS, CAR_CATEGORIES, IOT_DEVICES, CARS
# -------------------------------------------------------------------

import pandas as pd
from sqlalchemy import create_engine, text

# ----------------------------
# Connection
# ----------------------------
engine = create_engine(
    "oracle+oracledb://",
    connect_args={"user": "raw_layer", "password": "Raw#123", "dsn": "localhost:1521/XEPDB1"},
    pool_pre_ping=True,
)

# ----------------------------
# Helpers: truncate / delete / identity reset
# ----------------------------
TRUNCATE_ORDER = [
    # Children first
    "PAYMENTS",
    "RENTALS",
    "IOT_ALERTS",
    "MANAGERS",
    "CARS",
    "IOT_DEVICES",
    "CAR_CATEGORIES",
    "CUSTOMERS",
    "BRANCHES",  # Parents last
]

def try_truncate_or_delete(conn, table):
    try:
        conn.execute(text(f"TRUNCATE TABLE {table}"))
        print(f"🧹 TRUNCATE {table}")
        return
    except Exception as e:
        print(f"⚠️  TRUNCATE {table} failed → {e}; trying DELETE ...")
    deleted = conn.execute(text(f"DELETE FROM {table}")).rowcount
    print(f"🧽 DELETE {table}: {deleted} rows")

def restart_identities(conn):
    """
    Reset identity and classic sequences. Robust to XE column-name quirks.
    Strategy:
      1) USER_TAB_IDENTITY_COLS → SEQUENCE_NAME (if present)
      2) USER_SEQUENCES where SEQUENCE_NAME like 'ISEQ$$_%'
      3) (Dev-only fallback) all USER_SEQUENCES
      4) Try ALTER SEQUENCE ... RESTART; else do "increment trick"
    """
    # 1) Identity sequences (preferred)
    seq_names = []
    try:
        rows = pd.read_sql(text("SELECT * FROM USER_TAB_IDENTITY_COLS"), conn)
        if not rows.empty:
            rows.columns = [c.upper().strip() for c in rows.columns]
            if "SEQUENCE_NAME" in rows.columns:
                seq_names = rows["SEQUENCE_NAME"].dropna().astype(str).tolist()
    except Exception as e:
        print(f"ℹ️ USER_TAB_IDENTITY_COLS not accessible: {e}")

    # 2) Identity-like sequences if none found
    if not seq_names:
        try:
            idseqs = pd.read_sql(
                text("SELECT SEQUENCE_NAME FROM USER_SEQUENCES WHERE SEQUENCE_NAME LIKE 'ISEQ$$_%' ORDER BY SEQUENCE_NAME"),
                conn
            )
            idseqs.columns = [c.upper().strip() for c in idseqs.columns]
            if "SEQUENCE_NAME" in idseqs.columns:
                seq_names = idseqs["SEQUENCE_NAME"].astype(str).tolist()
        except Exception as e:
            print(f"ℹ️ USER_SEQUENCES (ISEQ) not accessible: {e}")

    # 3) (Optional) all sequences as last resort
    if not seq_names:
        try:
            allseqs = pd.read_sql(text("SELECT SEQUENCE_NAME FROM USER_SEQUENCES ORDER BY SEQUENCE_NAME"), conn)
            allseqs.columns = [c.upper().strip() for c in allseqs.columns]
            if "SEQUENCE_NAME" in allseqs.columns:
                seq_names = allseqs["SEQUENCE_NAME"].astype(str).tolist()
        except Exception as e:
            print(f"ℹ️ USER_SEQUENCES not accessible: {e}")

    if not seq_names:
        print("ℹ️ No sequences found to reset; skipping.")
        return

    for seq in seq_names:
        try:
            conn.execute(text(f"ALTER SEQUENCE {seq} RESTART START WITH 1"))
            print(f"🔁 RESET sequence {seq} → 1")
        except Exception as e:
            # Version-safe fallback: "increment trick"
            try:
                last = pd.read_sql(
                    text("SELECT LAST_NUMBER FROM USER_SEQUENCES WHERE SEQUENCE_NAME = :s"),
                    conn, params={"s": seq}
                )
                last.columns = [c.upper().strip() for c in last.columns]
                if not last.empty and "LAST_NUMBER" in last.columns:
                    last_num = int(last.iloc[0]["LAST_NUMBER"])
                    delta = 1 - last_num
                    conn.execute(text(f"ALTER SEQUENCE {seq} INCREMENT BY {delta}"))
                    _ = pd.read_sql(text(f"SELECT {seq}.NEXTVAL AS NV FROM DUAL"), conn)
                    conn.execute(text(f"ALTER SEQUENCE {seq} INCREMENT BY 1"))
                    print(f"🔁 RESET sequence {seq} via increment trick → 1")
                else:
                    print(f"⚠️ Could not read LAST_NUMBER for {seq}: {e}")
            except Exception as e2:
                print(f"⚠️ Could not reset sequence {seq}: {e2}")

def wipe_all_data():
    with engine.begin() as conn:
        for t in TRUNCATE_ORDER:
            try_truncate_or_delete(conn, t)
        restart_identities(conn)
    print("🧨 Database data wiped (business tables).")

# ----------------------------
# Utility mappers / metadata
# ----------------------------
def map_table(conn, sql, key_col, val_col):
    t = pd.read_sql(text(sql), conn)
    if t.empty:
        return {}
    t.columns = [c.upper() for c in t.columns]
    return dict(zip(t[key_col.upper()].astype(str), t[val_col.upper()].astype(int)))

def _get_iot_device_pk_name(conn):
    # Prefer identity column if defined for IOT_DEVICES
    idx = pd.read_sql(
        text("SELECT COLUMN_NAME FROM USER_TAB_IDENTITY_COLS WHERE TABLE_NAME = 'IOT_DEVICES'"),
        conn
    )
    if not idx.empty and "COLUMN_NAME" in [c.upper() for c in idx.columns]:
        col = str(idx.iloc[0][idx.columns[0]]).strip()
        return col

    # Else inspect columns, prefer DEVICE_ID if present
    cols = pd.read_sql(
        text("SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'IOT_DEVICES'"),
        conn
    )
    if cols.empty:
        raise RuntimeError("IOT_DEVICES not found or no columns visible.")
    names = [str(c).upper().strip() for c in cols["COLUMN_NAME"].tolist()]
    if "DEVICE_ID" in names:
        return "DEVICE_ID"
    return names[0]  # last resort

def _fetch_free_device_ids(conn, device_pk_col):
    # Devices INACTIVE and not linked to any CARS.DEVICE_ID
    q = f"""
        SELECT d.{device_pk_col} AS DEVICE_PK
        FROM IOT_DEVICES d
        LEFT JOIN CARS c ON c.DEVICE_ID = d.{device_pk_col}
        WHERE d.STATUS = 'INACTIVE' AND c.DEVICE_ID IS NULL
        ORDER BY d.{device_pk_col}
    """
    t = pd.read_sql(text(q), conn)
    t.columns = [c.upper().strip() for c in t.columns]
    return t["DEVICE_PK"].astype(int).tolist() if not t.empty else []

# ----------------------------
# Seeders
# ----------------------------
def seed_branches():
    data = [
        ("Casablanca HQ",   "Bd Al Massira, Maarif",           "Casablanca", "+212522000111", "casa.hq@carrental.ma"),
        ("Rabat Agdal",     "Av. de France, Agdal",            "Rabat",      "+212537000222", "rabat.agdal@carrental.ma"),
        ("Marrakech Gueliz","Av. Mohammed V, Gueliz",          "Marrakech",  "+212524000333", "marrakech.gueliz@carrental.ma"),
        ("Tanger Downtown", "Rue de la Liberté, Centre-ville", "Tanger",     "+212539000444", "tanger.dt@carrental.ma"),
        ("Agadir Plage",    "Corniche, Plage",                 "Agadir",     "+212602555666", "agadir.plage@carrental.ma"),
    ]
    df = pd.DataFrame(data, columns=["BRANCH_NAME","ADDRESS","CITY","PHONE","EMAIL"])
    with engine.begin() as conn:
        df.to_sql("BRANCHES", conn, if_exists="append", index=False)
    print(f"✅ Inserted {len(df)} branches")

def seed_managers():
    rows = [
        ("MGR101","Amina","Berrada","amina.berrada@carrental.ma","+212600100101","pwd#Casa1","Casablanca HQ"),
        ("MGR102","Karim","Saidi","karim.saidi@carrental.ma","+212600100102","pwd#Casa2","Casablanca HQ"),
        ("MGR201","Yassin","El Idrissi","yassin.elidrissi@carrental.ma","+212600200201","pwd#Rabat1","Rabat Agdal"),
        ("MGR202","Lina","Mouline","lina.mouline@carrental.ma","+212600200202","pwd#Rabat2","Rabat Agdal"),
        ("MGR301","Nadia","Zerouali","nadia.zerouali@carrental.ma","+212600300301","pwd#Mrk1","Marrakech Gueliz"),
        ("MGR302","Omar","Kabbaj","omar.kabbaj@carrental.ma","+212600300302","pwd#Mrk2","Marrakech Gueliz"),
        ("MGR401","Soukaina","Benali","soukaina.benali@carrental.ma","+212600400401","pwd#Tgr1","Tanger Downtown"),
        ("MGR402","Hicham","Alaoui","hicham.alaoui@carrental.ma","+212600400402","pwd#Tgr2","Tanger Downtown"),
        ("MGR501","Sara","El Fassi","sara.elfassi@carrental.ma","+212600500501","pwd#Agd1","Agadir Plage"),
        ("MGR502","Youssef","Boukhriss","youssef.boukhriss@carrental.ma","+212600500502","pwd#Agd2","Agadir Plage"),
    ]
    df = pd.DataFrame(rows, columns=["MANAGER_CODE","FIRST_NAME","LAST_NAME","EMAIL","PHONE","MANAGER_PASSWORD","BRANCH_NAME"])
    with engine.begin() as conn:
        bmap = map_table(conn, "SELECT BRANCH_ID, BRANCH_NAME FROM BRANCHES", "BRANCH_NAME", "BRANCH_ID")
        if not bmap:
            raise RuntimeError("Seed branches first.")
        missing = sorted(set(df.BRANCH_NAME.unique()) - set(bmap.keys()))
        if missing:
            raise RuntimeError(f"Unknown branches for managers: {missing}")
        df["BRANCH_ID"] = df["BRANCH_NAME"].map(bmap)
        ins = df[["MANAGER_CODE","FIRST_NAME","LAST_NAME","EMAIL","PHONE","MANAGER_PASSWORD","BRANCH_ID"]]
        ins.to_sql("MANAGERS", conn, if_exists="append", index=False)
    print(f"✅ Inserted {len(df)} managers")

def seed_categories():
    rows = [
        ("Economy",  "Small city cars; fuel-efficient and affordable"),
        ("SUV",      "Sport Utility Vehicles; spacious and powerful"),
        ("Luxury",   "Premium sedans and coupes; high comfort"),
        ("Van",      "7–9 seat vehicles for families or groups"),
        ("Electric", "Fully electric vehicles; zero emissions"),
    ]
    df = pd.DataFrame(rows, columns=["CATEGORY_NAME","DESCRIPTION"])
    with engine.begin() as conn:
        df.to_sql("CAR_CATEGORIES", conn, if_exists="append", index=False)
    print(f"✅ Inserted {len(df)} car categories")

def seed_iot_devices():
    rows = [
    ("DEV001", "IMEI1000000001", "v1.0.9"),
    ("DEV002", "IMEI1000000002", "v1.1.0"),
    ("DEV003", "IMEI1000000003", "v1.1.2"),
    ("DEV004", "IMEI1000000004", "v1.1.5"),
    ("DEV005", "IMEI1000000005", "v1.2.0"),
    ("DEV006", "IMEI1000000006", "v1.2.0"),
    ("DEV007", "IMEI1000000007", "v1.2.1"),
    ("DEV008", "IMEI1000000008", "v1.3.0"),
    ("DEV009", "IMEI1000000009", "v1.3.1"),
    ("DEV010", "IMEI1000000010", "v1.3.2"),
    ("DEV011", "IMEI1000000011", "v1.4.0"),
    ("DEV012", "IMEI1000000012", "v1.4.0"),
    ("DEV013", "IMEI1000000013", "v1.4.2"),
    ("DEV014", "IMEI1000000014", "v1.5.0"),
    ("DEV015", "IMEI1000000015", "v1.5.1"),
    ("DEV016", "IMEI1000000016", "v1.5.2"),
    ("DEV017", "IMEI1000000017", "v1.6.0"),
    ("DEV018", "IMEI1000000018", "v1.6.1"),
    ("DEV019", "IMEI1000000019", "v1.6.2"),
    ("DEV020", "IMEI1000000020", "v1.6.3"),
    ("DEV021", "IMEI1000000021", "v1.7.0"),
    ("DEV022", "IMEI1000000022", "v1.7.0"),
    ("DEV023", "IMEI1000000023", "v1.7.1"),
    ("DEV024", "IMEI1000000024", "v1.7.2"),
    ("DEV025", "IMEI1000000025", "v1.7.3"),
    ("DEV026", "IMEI1000000026", "v1.8.0"),
    ("DEV027", "IMEI1000000027", "v1.8.0"),
    ("DEV028", "IMEI1000000028", "v1.8.1"),
    ("DEV029", "IMEI1000000029", "v1.8.2"),
    ("DEV030", "IMEI1000000030", "v1.8.3"),
    ("DEV031", "IMEI1000000031", "v1.8.4"),
    ("DEV032", "IMEI1000000032", "v1.8.5"),
    ("DEV033", "IMEI1000000033", "v1.8.6"),
    ("DEV034", "IMEI1000000034", "v1.8.7"),
    ("DEV035", "IMEI1000000035", "v1.8.8"),
    ("DEV036", "IMEI1000000036", "v1.8.9"),
    ("DEV037", "IMEI1000000037", "v1.9.0"),
    ("DEV038", "IMEI1000000038", "v1.9.1"),
    ("DEV039", "IMEI1000000039", "v1.9.2"),
    ("DEV040", "IMEI1000000040", "v1.9.3"),
    ("DEV041", "IMEI1000000041", "v2.0.0"),
    ("DEV042", "IMEI1000000042", "v2.0.1"),
    ("DEV043", "IMEI1000000043", "v2.0.2"),
    ("DEV044", "IMEI1000000044", "v2.0.3"),
    ("DEV045", "IMEI1000000045", "v2.0.4"),
    ("DEV046", "IMEI1000000046", "v2.0.5"),
    ("DEV047", "IMEI1000000047", "v2.1.0"),
    ("DEV048", "IMEI1000000048", "v2.1.1"),
    ("DEV049", "IMEI1000000049", "v2.1.2"),
    ("DEV050", "IMEI1000000050", "v2.2.0"),
    ]

    df = pd.DataFrame(rows, columns=["DEVICE_CODE","DEVICE_IMEI","FIRMWARE_VERSION"])
    df["STATUS"] = "INACTIVE"
    df["ACTIVATED_AT"] = None
    df["LAST_SEEN_AT"] = None
    with engine.begin() as conn:
        df.to_sql("IOT_DEVICES", conn, if_exists="append", index=False)
    print(f"✅ Inserted {len(df)} IoT devices (INACTIVE)")

def seed_cars():
    rows = [
    # Casablanca HQ (15)
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

    # Rabat Agdal (10)
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

    # Marrakech Gueliz (10)
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

    # Tanger Downtown (10)
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

    # Agadir Plage (10)
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
        "CATEGORY_NAME","VIN","LICENSE_PLATE","MAKE","MODEL","MODEL_YEAR","COLOR","ODOMETER_KM","STATUS","BRANCH_NAME"
    ])
    with engine.begin() as conn:
        # Maps
        cmap = map_table(conn, "SELECT CATEGORY_ID, CATEGORY_NAME FROM CAR_CATEGORIES", "CATEGORY_NAME", "CATEGORY_ID")
        bmap = map_table(conn, "SELECT BRANCH_ID, BRANCH_NAME FROM BRANCHES", "BRANCH_NAME", "BRANCH_ID")
        if not cmap or not bmap:
            raise RuntimeError("Seed categories and branches first.")

        # Detect PK column of IOT_DEVICES and pull free IDs
        device_pk = _get_iot_device_pk_name(conn)
        free = _fetch_free_device_ids(conn, device_pk)

        # Validate maps
        missing_cat = sorted(set(df.CATEGORY_NAME.unique()) - set(cmap.keys()))
        missing_br  = sorted(set(df.BRANCH_NAME.unique())   - set(bmap.keys()))
        if missing_cat: raise RuntimeError(f"Unknown categories for cars: {missing_cat}")
        if missing_br:  raise RuntimeError(f"Unknown branches for cars: {missing_br}")

        # Resolve FKs + device assignment
        df["CATEGORY_ID"] = df["CATEGORY_NAME"].map(cmap)
        df["BRANCH_ID"]   = df["BRANCH_NAME"].map(bmap)
        df["DEVICE_ID"]   = [free.pop(0) if free else None for _ in range(len(df))]

        ins = df[[
            "CATEGORY_ID","DEVICE_ID","VIN","LICENSE_PLATE","MAKE","MODEL",
            "MODEL_YEAR","COLOR","ODOMETER_KM","STATUS","BRANCH_ID"
        ]]
        ins.to_sql("CARS", conn, if_exists="append", index=False)

        # 🔁 NEW: Activate any devices that got linked to cars
        assigned_ids = [int(x) for x in ins["DEVICE_ID"].dropna().unique().tolist()]
        if assigned_ids:
            id_list = ", ".join(map(str, assigned_ids))
            # Use the detected PK name for WHERE to be robust (in your schema it's DEVICE_ID)
            conn.execute(text(f"""
                UPDATE IOT_DEVICES
                   SET STATUS = 'ACTIVE',
                       ACTIVATED_AT = NVL(ACTIVATED_AT, SYSTIMESTAMP)
                 WHERE {device_pk} IN ({id_list})
            """))

    print(f"✅ Inserted {len(df)} cars with device assignment (linked devices set ACTIVE)")


# ----------------------------
# Main
# ----------------------------
def main():
    wipe_all_data()     # full reset
    seed_branches()
    seed_managers()
    seed_categories()
    seed_iot_devices()
    seed_cars()
    print("🎉 Static seed completed (fresh database).")

if __name__ == "__main__":
    main()