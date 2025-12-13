# 01_seed_static.py
# -------------------------------------------------------------------
# Full static seed with hard reset, robust sequence reset, and seeding:
# - Wipes all business tables (children -> parents)
# - Resets Oracle identity/classic sequences (XE-safe)
# - Seeds BRANCHES, MANAGERS, CAR_CATEGORIES, IOT_DEVICES, CARS (with IMAGE_URL)
# -------------------------------------------------------------------

import pandas as pd
from sqlalchemy import create_engine, text
import re

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
    Oracle identity sequences (ISEQ$$_xxxx) cannot be altered (ORA-32793).
    So: skip them. For dev seeds, it's fine if IDs continue increasing.
    """
    try:
        seqs = pd.read_sql(text("SELECT SEQUENCE_NAME FROM USER_SEQUENCES"), conn)
        if seqs.empty:
            print("ℹ️ No sequences found.")
            return
        seqs.columns = [c.upper().strip() for c in seqs.columns]
        names = seqs["SEQUENCE_NAME"].astype(str).tolist()
    except Exception as e:
        print(f"ℹ️ USER_SEQUENCES not accessible: {e}")
        return

    skipped = 0
    for seq in names:
        if seq.startswith("ISEQ$$_"):
            skipped += 1
            continue
        # if you created any custom sequences manually, you can reset them here if needed
        # otherwise do nothing

    if skipped:
        print(f"ℹ️ Skipped {skipped} system identity sequences (ISEQ$$_*)")





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
    idx = pd.read_sql(
        text("SELECT COLUMN_NAME FROM USER_TAB_IDENTITY_COLS WHERE TABLE_NAME = 'IOT_DEVICES'"),
        conn
    )
    if not idx.empty and "COLUMN_NAME" in [c.upper() for c in idx.columns]:
        col = str(idx.iloc[0][idx.columns[0]]).strip()
        return col

    cols = pd.read_sql(
        text("SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'IOT_DEVICES'"),
        conn
    )
    if cols.empty:
        raise RuntimeError("IOT_DEVICES not found or no columns visible.")
    names = [str(c).upper().strip() for c in cols["COLUMN_NAME"].tolist()]
    if "DEVICE_ID" in names:
        return "DEVICE_ID"
    return names[0]

def _fetch_free_device_ids(conn, device_pk_col):
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
# IMAGE URL helper (IMPORTANT)
# ----------------------------
def _slugify(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def car_image_url(make: str, model: str, year: int | None = None) -> str:
    """
    Returns a usable image URL for the car.
    Uses Unsplash Source (great for demo dashboards).
    """
    m = _slugify(make)
    md = _slugify(model)
    y = str(year) if year else ""
    # 'featured' returns a real image; query helps keep it car-related
    # 900x540 fits your card aspect nicely
    q = ",".join([x for x in [m, md, y, "car"] if x])
    return f"https://source.unsplash.com/featured/900x540/?{q}"

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




# ----------------------------
# Main
# ----------------------------
def main():
    wipe_all_data()
    seed_branches()
    seed_managers()
    seed_categories()
    seed_iot_devices()
    seed_cars()
    print("🎉 Static seed completed (fresh database).")

if __name__ == "__main__":
    main()
