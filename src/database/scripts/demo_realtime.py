# demo_realtime.py
# -------------------------------------------------------------------
# Real-time demo WITHOUT RESERVATIONS/RT_EVENTS:
# - 5 users / 5 branches
# - immediate visibility in RENTALS (STATUS='IN_PROGRESS')
# - auto switch to ACTIVE at start, CLOSED at return; CARS status synced
# - timestamped logs to stdout
# Prereq: run 01_seed_static.py first (branches, managers, categories, cars)
# -------------------------------------------------------------------

import time
import random
from datetime import datetime, timedelta
import pandas as pd
from sqlalchemy import create_engine, text

# =========================
# DB Connection
# =========================
engine = create_engine(
    "oracle+oracledb://",
    connect_args={"user": "raw_layer", "password": "Raw#123", "dsn": "localhost:1521/XEPDB1"},
    pool_pre_ping=True,
)

# =========================
# Config
# =========================
CURRENCY = "MAD"
RATES_PER_HOUR = {
    "ECONOMY": 50,
    "SUV": 90,
    "LUXURY": 150,
    "VAN": 120,
    "ELECTRIC": 80,
}

# 1 = real time. Example: 60 => 1 minute IRL = 1 hour simulated
ACCELERATION_FACTOR = 1

random.seed(42)

# =========================
# Utilities
# =========================
def log(msg: str):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)

def sleep_until(target: datetime):
    """Sleep until a target wall-clock time (supports acceleration)."""
    while True:
        now = datetime.now()
        if now >= target:
            return
        remaining = (target - now).total_seconds()
        time.sleep(max(0.5, remaining / ACCELERATION_FACTOR))

def df_norm(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [c.upper().strip() for c in df.columns]
    return df

def map_table(conn, sql, key_col, val_col):
    t = pd.read_sql(text(sql), conn)
    if t.empty:
        return {}
    t = df_norm(t)
    return dict(zip(t[key_col.upper()].astype(str), t[val_col.upper()]))

def _outval(v):
    """Handle Oracle RETURNING variables that often come back as [val]."""
    val = v.getvalue()
    return val[0] if isinstance(val, (list, tuple)) else val

# =========================
# DB helpers
# =========================
def upsert_customer(conn, first_name, last_name, email, phone, id_number) -> int:
    dup = pd.read_sql(
        text("SELECT CUSTOMER_ID FROM CUSTOMERS WHERE EMAIL = :em"),
        conn,
        params={"em": email},
    )
    if not dup.empty:
        return int(df_norm(dup).iloc[0]["CUSTOMER_ID"])

    raw = conn.connection
    cur = raw.cursor()
    rid = cur.var(int)
    cur.execute(
        """
        INSERT INTO CUSTOMERS (FIRST_NAME, LAST_NAME, EMAIL, PHONE, ID_NUMBER)
        VALUES (:fn, :ln, :em, :ph, :idn)
        RETURNING CUSTOMER_ID INTO :rid
        """,
        fn=first_name,
        ln=last_name,
        em=email,
        ph=phone,
        idn=id_number,
        rid=rid,
    )
    return int(_outval(rid))

def pick_manager(conn, branch_id) -> int | None:
    t = pd.read_sql(
        text(
            """
            SELECT MANAGER_ID FROM MANAGERS
            WHERE BRANCH_ID = :bid
            ORDER BY MANAGER_ID
            FETCH FIRST 1 ROWS ONLY
            """
        ),
        conn,
        params={"bid": branch_id},
    )
    if t.empty:
        return None
    return int(df_norm(t).iloc[0]["MANAGER_ID"])

def has_overlap(conn, car_id: int, start_at: datetime, due_at: datetime) -> bool:
    """
    Basic overlap check: any ACTIVE/IN_PROGRESS rental that overlaps [start_at, due_at).
    """
    q = """
        SELECT COUNT(*) AS CNT
        FROM RENTALS
        WHERE CAR_ID = :cid
          AND STATUS IN ('ACTIVE','IN_PROGRESS')
          AND (START_AT < :due_at AND DUE_AT > :start_at)
    """
    t = pd.read_sql(text(q), conn, params={"cid": car_id, "start_at": start_at, "due_at": due_at})
    return int(df_norm(t).iloc[0]["CNT"]) > 0

def find_available_car(conn, branch_id: int, category_id: int | None,
                       start_at: datetime, due_at: datetime) -> tuple[int | None, int]:
    """
    Pick a car that is AVAILABLE and has no overlapping rental.
    If category_id is None, skip category filter (fallback).
    """
    sql = """
        SELECT CAR_ID, ODOMETER_KM
        FROM CARS
        WHERE BRANCH_ID = :bid
          AND STATUS = 'AVAILABLE'
    """
    params = {"bid": branch_id}
    if category_id is not None:
        sql += " AND CATEGORY_ID = :cid"
        params["cid"] = category_id
    sql += " ORDER BY CAR_ID"

    cars = pd.read_sql(text(sql), conn, params=params)
    if cars.empty:
        return None, 0
    cars = df_norm(cars)

    for _, r in cars.iterrows():
        car_id = int(r["CAR_ID"])
        if not has_overlap(conn, car_id, start_at, due_at):
            odo = r.get("ODOMETER_KM")
            return car_id, int(0 if pd.isna(odo) else int(odo))
    return None, 0

def schedule_rental(conn, car_id, customer_id, branch_id, manager_id,
                    planned_start, planned_return, start_odo, currency=CURRENCY) -> int:
    """
    Insert a 'planned' rental row now (STATUS='IN_PROGRESS') so it's visible immediately,
    and reserve the car (CARS.STATUS='RESERVED').
    """
    raw = conn.connection
    cur = raw.cursor()
    rid = cur.var(int)
    cur.execute(
        """
        INSERT INTO RENTALS(
          CAR_ID, CUSTOMER_ID, BRANCH_ID, MANAGER_ID,
          START_AT, DUE_AT, STATUS, START_ODOMETER, CURRENCY
        ) VALUES (
          :car, :cust, :bid, :mgr, :s, :d, 'IN_PROGRESS', :odo, :cur
        )
        RETURNING RENTAL_ID INTO :rid
        """,
        car=car_id,
        cust=customer_id,
        bid=branch_id,
        mgr=manager_id,
        s=planned_start,
        d=planned_return,
        odo=start_odo,
        cur=currency,
        rid=rid,
    )
    conn.execute(text("UPDATE CARS SET STATUS='RESERVED' WHERE CAR_ID=:cid"), {"cid": car_id})
    return int(_outval(rid))

def activate_rental(conn, rental_id, car_id):
    conn.execute(text("UPDATE RENTALS SET STATUS='ACTIVE' WHERE RENTAL_ID=:rid"), {"rid": rental_id})
    conn.execute(text("UPDATE CARS SET STATUS='RENTED' WHERE CAR_ID=:cid"), {"cid": car_id})

def close_rental(conn, rental_id, car_id, return_at, end_odo, total_amount):
    conn.execute(
        text(
            """
            UPDATE RENTALS
               SET RETURN_AT = :r,
                   END_ODOMETER = :e,
                   TOTAL_AMOUNT = :amt,
                   STATUS = 'CLOSED'
             WHERE RENTAL_ID = :rid
            """
        ),
        {"r": return_at, "e": end_odo, "amt": total_amount, "rid": rental_id},
    )
    conn.execute(text("UPDATE CARS SET STATUS='AVAILABLE' WHERE CAR_ID=:cid"), {"cid": car_id})

def hours_between(a: datetime, b: datetime) -> float:
    return max(0.0, (b - a).total_seconds() / 3600.0)

def compute_amount(category_name: str, start_at: datetime, return_at: datetime) -> float:
    hours = hours_between(start_at, return_at)
    rate = RATES_PER_HOUR.get(category_name.upper(), 70)
    return round(rate * hours, 2)

# =========================
# Scenario: 5 users / 5 branches
# =========================
SCENARIO = [
    # 1) Casablanca / Economy — return next day 10:00
    {"branch": "Casablanca HQ",    "category": "Economy",  "offset_min": 5,  "return": "next_day_10"},
    # 2) Rabat / SUV — return +8h
    {"branch": "Rabat Agdal",      "category": "SUV",      "offset_min": 10, "return": "same_day_plus_hours", "hours": 8},
    # 3) Marrakech / Luxury — return +26h
    {"branch": "Marrakech Gueliz", "category": "Luxury",   "offset_min": 15, "return": "plus_hours", "hours": 26},
    # 4) Tanger / Van — return +3h
    {"branch": "Tanger Downtown",  "category": "Van",      "offset_min": 20, "return": "same_day_plus_hours", "hours": 3},
    # 5) Agadir / Electric — return next day 18:00
    {"branch": "Agadir Plage",     "category": "Electric", "offset_min": 25, "return": "next_day_18"},
]

USERS = [
    dict(first="Youssef", last="Haddad",  email="youssef.haddad@example.ma",  phone="+212600500001", idn="CIN-A001"),
    dict(first="Amina",   last="Berrada", email="amina.berrada@example.ma",   phone="+212600500002", idn="CIN-A002"),
    dict(first="Omar",    last="Kabbaj",  email="omar.kabbaj@example.ma",     phone="+212600500003", idn="CIN-A003"),
    dict(first="Sara",    last="El Fassi",email="sara.elfassi@example.ma",    phone="+212600500004", idn="CIN-A004"),
    dict(first="Nadia",   last="Zerouali",email="nadia.zerouali@example.ma",  phone="+212600500005", idn="CIN-A005"),
]

def resolve_return_time(start_at: datetime, rule: dict) -> datetime:
    typ = rule["return"]
    if typ == "next_day_10":
        return (start_at + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
    if typ == "next_day_18":
        return (start_at + timedelta(days=1)).replace(hour=18, minute=0, second=0, microsecond=0)
    if typ == "same_day_plus_hours":
        return start_at + timedelta(hours=rule.get("hours", 6))
    if typ == "plus_hours":
        return start_at + timedelta(hours=rule.get("hours", 24))
    return start_at + timedelta(hours=6)

# =========================
# Main
# =========================
def main():
    log("=" * 74)
    log("DEMO TEMPS REEL — 5 utilisateurs / 5 agences (sans RESERVATIONS/RT_EVENTS)")
    log("Assurez-vous que 01_seed_static.py a été exécuté (cars must be AVAILABLE).")
    log("=" * 74)

    script_t0 = datetime.now()

    # Prepare maps once
    with engine.begin() as conn:
        bmap = map_table(conn, "SELECT BRANCH_NAME, BRANCH_ID FROM BRANCHES", "BRANCH_NAME", "BRANCH_ID")
        cmap = map_table(conn, "SELECT CATEGORY_NAME, CATEGORY_ID FROM CAR_CATEGORIES", "CATEGORY_NAME", "CATEGORY_ID")
        if not bmap or not cmap:
            raise RuntimeError("Static data missing: run 01_seed_static.py first.")
        cmap = {k.upper(): v for k, v in cmap.items()}

    # Plan & insert scheduled rentals immediately
    plans_materialized = []
    for idx, plan in enumerate(SCENARIO):
        user          = USERS[idx]
        branch_name   = plan["branch"]
        category_name = plan["category"]
        offset_min    = plan["offset_min"]

        planned_start  = script_t0 + timedelta(minutes=offset_min)
        planned_return = resolve_return_time(planned_start, plan)

        with engine.begin() as conn:
            branch_id = bmap[branch_name]
            cat_id    = cmap.get(category_name.upper())
            cust_id   = upsert_customer(conn, user["first"], user["last"], user["email"], user["phone"], user["idn"])
            mgr_id    = pick_manager(conn, branch_id)

            # find car (with category, fallback without)
            car_id, start_odo = find_available_car(conn, branch_id, cat_id, planned_start, planned_return)
            if car_id is None:
                car_id, start_odo = find_available_car(conn, branch_id, None, planned_start, planned_return)

            if car_id is None:
                log(f"❌ Plan #{idx+1} | {branch_name} | no available car "
                    f"{planned_start:%Y-%m-%d %H:%M} → {planned_return:%Y-%m-%d %H:%M}")
                continue

            rental_id = schedule_rental(
                conn, car_id, cust_id, branch_id, mgr_id,
                planned_start, planned_return, start_odo, CURRENCY
            )

            plans_materialized.append(
                dict(
                    idx=idx+1,
                    rental_id=rental_id,
                    branch_name=branch_name,
                    category_name=category_name,
                    car_id=car_id,
                    start_odo=start_odo,
                    planned_start=planned_start,
                    planned_return=planned_return,
                )
            )

            log(f"📝 SCHEDULED RENTAL #{rental_id} | {branch_name} | car_id={car_id} | "
                f"client={user['first']} {user['last']} | cat={category_name} | "
                f"start@{planned_start:%H:%M} → return@{planned_return:%Y-%m-%d %H:%M} | car=RESERVED")

    # Execute plans: activate at start, close at return
    for p in plans_materialized:
        sleep_until(p["planned_start"])
        with engine.begin() as conn:
            activate_rental(conn, p["rental_id"], p["car_id"])
            log(f"✅ START RENTAL #{p['rental_id']} | {p['branch_name']} | car_id={p['car_id']} | "
                f"start_odo={p['start_odo']} | STATUS=ACTIVE")

        sleep_until(p["planned_return"])
        dur_h    = hours_between(p["planned_start"], p["planned_return"])
        delta_km = int(30 + dur_h * random.uniform(5, 15))
        end_odo  = p["start_odo"] + delta_km
        amount   = compute_amount(p["category_name"], p["planned_start"], p["planned_return"])

        with engine.begin() as conn:
            close_rental(conn, p["rental_id"], p["car_id"], p["planned_return"], end_odo, amount)

        log(f"🟢 RETURN RENTAL #{p['rental_id']} | car_id={p['car_id']} | return_odo={end_odo} | amount={amount:.2f} {CURRENCY}")

    log("🏁 All scheduled rentals processed.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("⏹️  Interrupted by user.")
