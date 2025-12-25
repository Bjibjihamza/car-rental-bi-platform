# ============================================================
# 02_live_iot_simulator.py
# ============================================================
# Real-time IoT simulator (15s ticks)
#
# GOALS:
# - Generate telemetry LIVE (no 7-day plan)
# - Write directly into SILVER_LAYER.RT_IOT_FEED
# - Create / close RENTALS from ENGINE_START / ENGINE_STOP
# - Update CARS status + odometer
# - Insert IOT_ALERTS with cooldown dedup
#
# Optional:
# - You can disable history insert into IOT_TELEMETRY (default OFF)
#
# This script is meant for demos: run, watch UI, stop when you want.
# ============================================================


from __future__ import annotations

import math
import random
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
from sqlalchemy import create_engine, text

# ==============================
# CONFIG
# ==============================

SCHEMA = "SILVER_LAYER"

ORACLE_URL = "oracle+oracledb://"
CONNECT_ARGS = {"user": "silver_layer", "password": "Silver#123", "dsn": "localhost:1521/XEPDB1"}

TICK_SEC = 15
SPEEDUP = 1.0  # 2.0 = twice faster, etc.

RESET_ON_START = True

# If True, we also insert rows into IOT_TELEMETRY (history)
WRITE_HISTORY_IOT_TELEMETRY = False

# If True, delete simulator rentals at start (safe strategy below)
RESET_RENTALS_CREATED_BY_SIM = True

# used to mark simulator rentals (so we don’t delete manual ones)
SIM_MARK_CURRENCY = "SIM"        # ✅ valid ISO currency for UI
SIM_STATUS_ACTIVE = "ACTIVE_SIM" # ✅ mark simulator rentals via STATUS
SIM_STATUS_CLOSED = "CLOSED_SIM"
UI_CURRENCY = "MAD"         # ✅ what you want to show in UI formatting (optional)

SIM_TAG_MANAGER_ID = -9999  # ✅ use manager id as marker for simulator rows (safe for demo)

# basic driving activity probabilities (per car per tick)
P_START_ENGINE_IF_OFF = 0.03
P_STOP_ENGINE_IF_ON = 0.02
P_GO_IDLE_IF_ON = 0.10
P_GO_DRIVING_IF_ON = 0.70
# remaining = STOPPED

# speed profiles by category
CATEGORY_SPEED_PROFILE = {
    "ECONOMY":  {"city": (18, 55), "mixed": (25, 80), "highway": (75, 110)},
    "SUV":      {"city": (18, 60), "mixed": (30, 90), "highway": (85, 130)},
    "LUXURY":   {"city": (18, 60), "mixed": (35, 105), "highway": (95, 145)},
    "VAN":      {"city": (15, 50), "mixed": (25, 80), "highway": (75, 120)},
    "ELECTRIC": {"city": (18, 55), "mixed": (25, 80), "highway": (75, 120)},
}
CATEGORY_FUEL_CONS = {"ECONOMY": 6.2, "SUV": 8.7, "LUXURY": 9.8, "VAN": 9.3, "ELECTRIC": 0.0}
CATEGORY_TANK_SIZE = {"ECONOMY": 45,  "SUV": 60,  "LUXURY": 65,  "VAN": 75,  "ELECTRIC": 0}

CITY_COORDS = {
    "CASABLANCA": (33.5731, -7.5898),
    "RABAT":      (34.0209, -6.8416),
    "MARRAKECH":  (31.6295, -7.9811),
    "TANGER":     (35.7595, -5.8340),
    "AGADIR":     (30.4278, -9.5981),
}

PRICING_DAY = {
    "ECONOMY": 320,
    "SUV": 520,
    "LUXURY": 850,
    "VAN": 600,
    "ELECTRIC": 480,
}

# Alerts
ALERT_COOLDOWN_SEC = 180
ALERT_RULES = {
    "OVER_SPEED":  {"severity": "HIGH",   "speed_kmh": 120},
    "OVERHEAT":    {"severity": "HIGH",   "engine_temp_c": 110},
    "LOW_FUEL":    {"severity": "MEDIUM", "fuel_pct": 12},
    "HARSH_BRAKE": {"severity": "MEDIUM", "brake_bar": 65},
}

engine = create_engine(ORACLE_URL, connect_args=CONNECT_ARGS, pool_pre_ping=True)

# ==============================
# SMALL UTILS
# ==============================

def clamp(x, lo, hi):
    return max(lo, min(hi, x))

def to_upper_cols(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [c.upper().strip() for c in df.columns]
    return df

def haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat/2)**2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def pick_trip_type() -> str:
    r = random.random()
    if r < 0.55: return "city"
    if r < 0.85: return "mixed"
    return "highway"

def sample_speed_kmh(category: str, trip_type: str) -> float:
    prof = CATEGORY_SPEED_PROFILE.get(category.upper(), CATEGORY_SPEED_PROFILE["ECONOMY"])
    vmin, vmax = prof[trip_type]
    return random.uniform(vmin, vmax)

def compute_acc_ms2(prev_speed_kmh: Optional[float], speed_kmh: float, dt_s: int) -> float:
    if prev_speed_kmh is None: return 0.0
    v1 = prev_speed_kmh / 3.6
    v2 = speed_kmh / 3.6
    return (v2 - v1) / dt_s

def brake_pressure_bar(acc_ms2: float) -> float:
    if acc_ms2 < -2.5: return random.uniform(35, 80)
    if acc_ms2 < -1.0: return random.uniform(10, 35)
    return random.uniform(0, 4)

def simulate_battery_voltage(engine_on: bool) -> float:
    return random.uniform(13.5, 14.4) if engine_on else random.uniform(12.2, 12.9)

def simulate_engine_temp(prev: Optional[float], speed_kmh: float, engine_on: bool) -> float:
    if not engine_on:
        if prev is None: return 25.0
        return max(25.0, prev - random.uniform(0.2, 0.6))
    if prev is None:
        prev = 45.0
    target = 92.0 if speed_kmh > 30 else 75.0
    prev = prev + (target - prev) * random.uniform(0.08, 0.12)
    return prev + random.uniform(-0.8, 0.8)

def update_fuel_pct(fuel_pct: float, category: str, speed_kmh: float, dt_s: int) -> float:
    cat = category.upper()
    cons = CATEGORY_FUEL_CONS.get(cat, 0.0)
    tank = CATEGORY_TANK_SIZE.get(cat, 0)
    if cons <= 0 or tank <= 0:
        return fuel_pct
    dist_km = speed_kmh * dt_s / 3600.0
    cons_l = cons * dist_km / 100.0
    cons_pct = (cons_l / tank) * 100.0
    return max(0.0, fuel_pct - cons_pct)

def city_center(city: str):
    return CITY_COORDS.get((city or "CASABLANCA").upper(), CITY_COORDS["CASABLANCA"])

def safe_num(v):
    if v is None:
        return None
    try:
        f = float(v)
        return f if f == f else None
    except Exception:
        return None

# ==============================
# DB SETUP / LOAD SEEDS
# ==============================

def alter_schema(conn):
    try:
        conn.execute(text(f"ALTER SESSION SET CURRENT_SCHEMA = {SCHEMA}"))
    except Exception:
        pass

def ensure_rt_table_exists(conn):
    try:
        conn.execute(text("SELECT 1 FROM RT_IOT_FEED WHERE 1=0"))
        return
    except Exception:
        pass

    conn.execute(text("""
        CREATE TABLE RT_IOT_FEED (
          TELEMETRY_ID       NUMBER,
          DEVICE_ID          NUMBER NOT NULL,
          CAR_ID             NUMBER NOT NULL,
          RENTAL_ID          NUMBER,
          EVENT_TS           TIMESTAMP NOT NULL,
          LATITUDE           NUMBER(10, 7),
          LONGITUDE          NUMBER(10, 7),
          SPEED_KMH          NUMBER(6, 2),
          ACCELERATION_MS2   NUMBER(6, 3),
          BRAKE_PRESSURE_BAR NUMBER(5, 2),
          FUEL_LEVEL_PCT     NUMBER(5, 2),
          BATTERY_VOLTAGE    NUMBER(4, 2),
          ENGINE_TEMP_C      NUMBER(5, 2),
          ODOMETER_KM        NUMBER(10, 0),
          EVENT_TYPE         VARCHAR2(50),
          CREATED_AT         TIMESTAMP,
          RECEIVED_AT        TIMESTAMP DEFAULT SYSTIMESTAMP
        )
    """))
    conn.execute(text("CREATE INDEX IDX_RT_RECEIVED ON RT_IOT_FEED(RECEIVED_AT)"))
    conn.execute(text("CREATE INDEX IDX_RT_CAR_ID   ON RT_IOT_FEED(CAR_ID)"))

def ensure_iot_alerts_table_exists(conn):
    try:
        conn.execute(text("SELECT 1 FROM IOT_ALERTS WHERE 1=0"))
        return
    except Exception:
        pass

    conn.execute(text("""
        CREATE TABLE IOT_ALERTS (
          ALERT_ID     NUMBER GENERATED BY DEFAULT ON NULL AS IDENTITY,
          CAR_ID       NUMBER NOT NULL,
          BRANCH_ID    NUMBER,
          RENTAL_ID    NUMBER,
          ALERT_TYPE   VARCHAR2(50) NOT NULL,
          SEVERITY     VARCHAR2(10) NOT NULL,
          TITLE        VARCHAR2(200),
          DESCRIPTION  VARCHAR2(500),
          STATUS       VARCHAR2(20) DEFAULT 'OPEN',
          EVENT_TS     TIMESTAMP,
          CREATED_AT   TIMESTAMP DEFAULT SYSTIMESTAMP
        )
    """))
    conn.execute(text("CREATE INDEX IDX_ALERTS_CAR_TS ON IOT_ALERTS(CAR_ID, EVENT_TS)"))
    conn.execute(text("CREATE INDEX IDX_ALERTS_STATUS ON IOT_ALERTS(STATUS)"))

def load_supervisor_id(conn) -> int:
    row = conn.execute(text("""
        SELECT MANAGER_ID
        FROM MANAGERS
        WHERE ROLE='SUPERVISOR'
        ORDER BY MANAGER_ID
        FETCH FIRST 1 ROWS ONLY
    """)).fetchone()
    if not row:
        raise RuntimeError("No SUPERVISOR found in MANAGERS")
    return int(row[0])

def load_customers(conn) -> list[int]:
    return [int(r[0]) for r in conn.execute(text("SELECT CUSTOMER_ID FROM CUSTOMERS")).fetchall()]

def load_cars(conn) -> pd.DataFrame:
    df = pd.read_sql(text("""
        SELECT
          c.CAR_ID,
          c.BRANCH_ID,
          b.CITY,
          c.DEVICE_ID,
          c.ODOMETER_KM,
          c.STATUS AS CAR_STATUS,
          cat.CATEGORY_NAME
        FROM CARS c
        JOIN BRANCHES b ON b.BRANCH_ID = c.BRANCH_ID
        JOIN CAR_CATEGORIES cat ON cat.CATEGORY_ID = c.CATEGORY_ID
        WHERE c.DEVICE_ID IS NOT NULL
        ORDER BY c.BRANCH_ID, c.CAR_ID
    """), conn)
    return to_upper_cols(df)

def reset_tables(conn):
    conn.execute(text("DELETE FROM RT_IOT_FEED"))
    conn.execute(text("DELETE FROM IOT_ALERTS"))
    if WRITE_HISTORY_IOT_TELEMETRY:
        conn.execute(text("DELETE FROM IOT_TELEMETRY"))

    if RESET_RENTALS_CREATED_BY_SIM:
        # free cars for simulator rentals
        conn.execute(text(f"""
            UPDATE {SCHEMA}.CARS
               SET STATUS='AVAILABLE'
             WHERE CAR_ID IN (
               SELECT CAR_ID
               FROM {SCHEMA}.RENTALS
               WHERE CURRENCY = :cur
             )
        """), {"cur": SIM_MARK_CURRENCY})

        # delete simulator rentals only
        conn.execute(text(f"""
            DELETE FROM {SCHEMA}.RENTALS
             WHERE CURRENCY = :cur
        """), {"cur": SIM_MARK_CURRENCY})

# ==============================
# RENTAL HELPERS
# ==============================
def get_active_rental(conn, car_id: int) -> Optional[int]:
    row = conn.execute(text(f"""
        SELECT RENTAL_ID
        FROM {SCHEMA}.RENTALS
        WHERE CAR_ID=:cid
          AND STATUS IN ('ACTIVE','IN_PROGRESS')
        ORDER BY RENTAL_ID DESC
        FETCH FIRST 1 ROWS ONLY
    """), {"cid": car_id}).fetchone()
    return int(row[0]) if row else None

def category_price_range_mad(category: str) -> tuple[float, float]:
    """
    Non-random ranges by category:
      - ECONOMY: 200..400
      - ELECTRIC: 300..500
      - LUXURY: 800..1200
      - SUV, VAN: 500..1000
      - default: 200..1000
    """
    c = (category or "").upper().strip()

    if c == "ECONOMY":
        return (200.0, 400.0)
    if c == "ELECTRIC":
        return (300.0, 500.0)
    if c == "LUXURY":
        return (800.0, 1200.0)
    if c in ("SUV", "VAN"):
        return (500.0, 1000.0)

    return (200.0, 1000.0)

def clamp_price_day_mad(category: str, day_price: float) -> float:
    lo, hi = category_price_range_mad(category)
    return float(clamp(float(day_price), lo, hi))

def is_car_available_for_rental(conn, car_id: int) -> bool:
    """
    Car can start a rental only if:
    - car status is AVAILABLE
    - and no ACTIVE/IN_PROGRESS rental exists
    """
    r = conn.execute(text(f"""
        SELECT STATUS
        FROM {SCHEMA}.CARS
        WHERE CAR_ID=:cid
    """), {"cid": car_id}).fetchone()

    if not r:
        return False

    car_status = str(r[0] or "").upper().strip()
    if car_status != "AVAILABLE":
        return False

    return get_active_rental(conn, car_id) is None

def create_rental(conn, *, car_id: int, branch_id: int, customer_id: int, manager_id: int,
                  start_ts: datetime, start_odo: float, category: str) -> int:
    base_day = PRICING_DAY.get((category or "").upper(), 300)
    day_price = clamp_price_day_mad(category, base_day)

    due_at = start_ts + timedelta(days=2)
    total_amount = float(day_price * 2)

    raw = conn.connection
    cur = raw.cursor()
    out_id = cur.var(int)

    cur.execute(f"""
        INSERT INTO {SCHEMA}.RENTALS (
          CAR_ID, CUSTOMER_ID, BRANCH_ID, MANAGER_ID,
          START_AT, DUE_AT, STATUS,
          START_ODOMETER, TOTAL_AMOUNT, CURRENCY,
          CREATED_AT
        ) VALUES (
          :cid, :cust, :bid, :mid,
          :start_at, :due_at, 'ACTIVE',
          :odo, :amt, :cur,
          SYSTIMESTAMP
        )
        RETURNING RENTAL_ID INTO :out_id
    """, {
        "cid": car_id,
        "cust": customer_id,
        "bid": branch_id,
        "mid": int(manager_id),      # ✅ real manager (FK ok)
        "start_at": start_ts,
        "due_at": due_at,
        "odo": float(start_odo),
        "amt": total_amount,
        "cur": SIM_MARK_CURRENCY,    # ✅ SIM marker
        "out_id": out_id,
    })

    rid = out_id.getvalue()
    rid = int(rid[0]) if isinstance(rid, list) else int(rid)
    cur.close()

    conn.execute(text(f"UPDATE {SCHEMA}.CARS SET STATUS='RENTED' WHERE CAR_ID=:cid"), {"cid": car_id})
    return rid


def close_rental(conn, *, rental_id: int, car_id: int, end_ts: datetime, end_odo: float):
    conn.execute(text(f"""
        UPDATE {SCHEMA}.RENTALS
           SET STATUS='CLOSED',
               RETURN_AT=:ret,
               END_ODOMETER=:odo
         WHERE RENTAL_ID=:rid
    """), {"rid": rental_id, "ret": end_ts, "odo": end_odo})

    conn.execute(text(f"""
        UPDATE {SCHEMA}.CARS
           SET STATUS='AVAILABLE',
               ODOMETER_KM=:odo
         WHERE CAR_ID=:cid
    """), {"cid": car_id, "odo": end_odo})

# ==============================
# ALERT HELPERS
# ==============================

def should_insert_alert(conn, car_id: int, alert_type: str, event_ts: datetime) -> bool:
    since = event_ts - timedelta(seconds=ALERT_COOLDOWN_SEC)
    row = conn.execute(text(f"""
        SELECT COUNT(*)
          FROM {SCHEMA}.IOT_ALERTS
         WHERE CAR_ID = :carId
           AND ALERT_TYPE = :atype
           AND EVENT_TS >= :since
           AND STATUS = 'OPEN'
    """), {"carId": car_id, "atype": alert_type, "since": since}).fetchone()
    return int(row[0] or 0) == 0

def insert_alert(conn, *, car_id: int, branch_id: int, rental_id: Optional[int],
                 alert_type: str, severity: str, title: str, desc: str, event_ts: datetime):
    conn.execute(text(f"""
        INSERT INTO {SCHEMA}.IOT_ALERTS (
          CAR_ID, BRANCH_ID, RENTAL_ID,
          ALERT_TYPE, SEVERITY, TITLE, DESCRIPTION,
          STATUS, EVENT_TS, CREATED_AT
        ) VALUES (
          :carId, :branchId, :rentalId,
          :atype, :sev, :title, :desc,
          'OPEN', :eventTs, SYSTIMESTAMP
        )
    """), {
        "carId": car_id,
        "branchId": branch_id,
        "rentalId": rental_id,
        "atype": alert_type,
        "sev": severity,
        "title": title,
        "desc": desc,
        "eventTs": event_ts,
    })

def detect_alerts(conn, *, car_id: int, branch_id: int, rental_id: Optional[int],
                  speed: Optional[float], temp: Optional[float], fuel: Optional[float], brake: Optional[float],
                  event_ts: datetime):
    # OVER SPEED
    thr = ALERT_RULES["OVER_SPEED"]["speed_kmh"]
    if speed is not None and speed >= thr:
        atype = "OVER_SPEED"
        if should_insert_alert(conn, car_id, atype, event_ts):
            insert_alert(conn, car_id=car_id, branch_id=branch_id, rental_id=rental_id,
                         alert_type=atype, severity=ALERT_RULES["OVER_SPEED"]["severity"],
                         title="Overspeed detected",
                         desc=f"Speed {speed:.0f} km/h exceeds {thr} km/h",
                         event_ts=event_ts)

    # OVERHEAT
    thr = ALERT_RULES["OVERHEAT"]["engine_temp_c"]
    if temp is not None and temp >= thr:
        atype = "OVERHEAT"
        if should_insert_alert(conn, car_id, atype, event_ts):
            insert_alert(conn, car_id=car_id, branch_id=branch_id, rental_id=rental_id,
                         alert_type=atype, severity=ALERT_RULES["OVERHEAT"]["severity"],
                         title="Engine overheating",
                         desc=f"Engine temp {temp:.0f}°C exceeds {thr}°C",
                         event_ts=event_ts)

    # LOW FUEL
    thr = ALERT_RULES["LOW_FUEL"]["fuel_pct"]
    if fuel is not None and fuel <= thr:
        atype = "LOW_FUEL"
        if should_insert_alert(conn, car_id, atype, event_ts):
            insert_alert(conn, car_id=car_id, branch_id=branch_id, rental_id=rental_id,
                         alert_type=atype, severity=ALERT_RULES["LOW_FUEL"]["severity"],
                         title="Low fuel",
                         desc=f"Fuel {fuel:.0f}% below {thr}%",
                         event_ts=event_ts)

    # HARSH BRAKE
    thr = ALERT_RULES["HARSH_BRAKE"]["brake_bar"]
    if brake is not None and brake >= thr:
        atype = "HARSH_BRAKE"
        if should_insert_alert(conn, car_id, atype, event_ts):
            insert_alert(conn, car_id=car_id, branch_id=branch_id, rental_id=rental_id,
                         alert_type=atype, severity=ALERT_RULES["HARSH_BRAKE"]["severity"],
                         title="Harsh braking",
                         desc=f"Brake {brake:.0f} bar exceeds {thr} bar",
                         event_ts=event_ts)

# ==============================
# SIM STATE
# ==============================

@dataclass
class CarState:
    car_id: int
    branch_id: int
    city: str
    device_id: int
    category: str

    engine_on: bool
    trip_type: str

    lat: float
    lng: float

    speed_kmh: float
    prev_speed_kmh: Optional[float]

    fuel_pct: float
    engine_temp_c: float
    odometer_km: float

def init_state_from_cars(cars_df: pd.DataFrame) -> dict[int, CarState]:
    states: dict[int, CarState] = {}

    for _, r in cars_df.iterrows():
        car_id = int(r["CAR_ID"])
        branch_id = int(r["BRANCH_ID"])
        city = str(r["CITY"] or "CASABLANCA")
        device_id = int(r["DEVICE_ID"])
        category = str(r["CATEGORY_NAME"] or "ECONOMY")

        lat0, lng0 = city_center(city)

        states[car_id] = CarState(
            car_id=car_id,
            branch_id=branch_id,
            city=city,
            device_id=device_id,
            category=category,
            engine_on=False,
            trip_type=pick_trip_type(),
            lat=lat0 + random.uniform(-0.02, 0.02),
            lng=lng0 + random.uniform(-0.02, 0.02),
            speed_kmh=0.0,
            prev_speed_kmh=None,
            fuel_pct=100.0,
            engine_temp_c=25.0,
            odometer_km=float(r["ODOMETER_KM"] or 0.0),
        )

    return states

# ==============================
# TICK GENERATION
# ==============================

def tick_one_car(s: CarState, dt_s: int) -> dict:
    """
    Returns a telemetry row dict for RT_IOT_FEED.
    """
    event_ts = datetime.now()

    # engine start/stop transitions
    if not s.engine_on and random.random() < P_START_ENGINE_IF_OFF:
        s.engine_on = True
        s.trip_type = pick_trip_type()
        s.prev_speed_kmh = 0.0
        s.speed_kmh = 0.0
        s.engine_temp_c = simulate_engine_temp(s.engine_temp_c, 0.0, True)
        return {
            "DEVICE_ID": s.device_id,
            "CAR_ID": s.car_id,
            "EVENT_TS": event_ts,
            "LATITUDE": s.lat,
            "LONGITUDE": s.lng,
            "SPEED_KMH": 0.0,
            "ACCELERATION_MS2": 0.0,
            "BRAKE_PRESSURE_BAR": 0.0,
            "FUEL_LEVEL_PCT": float(s.fuel_pct),
            "BATTERY_VOLTAGE": float(simulate_battery_voltage(True)),
            "ENGINE_TEMP_C": float(s.engine_temp_c),
            "ODOMETER_KM": float(s.odometer_km),
            "EVENT_TYPE": "ENGINE_START",
            "CREATED_AT": event_ts,
        }

    if s.engine_on and random.random() < P_STOP_ENGINE_IF_ON:
        s.engine_on = False
        s.prev_speed_kmh = s.speed_kmh
        s.speed_kmh = 0.0
        s.engine_temp_c = simulate_engine_temp(s.engine_temp_c, 0.0, False)
        return {
            "DEVICE_ID": s.device_id,
            "CAR_ID": s.car_id,
            "EVENT_TS": event_ts,
            "LATITUDE": s.lat,
            "LONGITUDE": s.lng,
            "SPEED_KMH": 0.0,
            "ACCELERATION_MS2": 0.0,
            "BRAKE_PRESSURE_BAR": 0.0,
            "FUEL_LEVEL_PCT": float(s.fuel_pct),
            "BATTERY_VOLTAGE": float(simulate_battery_voltage(False)),
            "ENGINE_TEMP_C": float(s.engine_temp_c),
            "ODOMETER_KM": float(s.odometer_km),
            "EVENT_TYPE": "ENGINE_STOP",
            "CREATED_AT": event_ts,
        }

    # if engine off => stopped idle point
    if not s.engine_on:
        return {
            "DEVICE_ID": s.device_id,
            "CAR_ID": s.car_id,
            "EVENT_TS": event_ts,
            "LATITUDE": s.lat,
            "LONGITUDE": s.lng,
            "SPEED_KMH": 0.0,
            "ACCELERATION_MS2": 0.0,
            "BRAKE_PRESSURE_BAR": 0.0,
            "FUEL_LEVEL_PCT": float(s.fuel_pct),
            "BATTERY_VOLTAGE": float(simulate_battery_voltage(False)),
            "ENGINE_TEMP_C": float(simulate_engine_temp(s.engine_temp_c, 0.0, False)),
            "ODOMETER_KM": float(s.odometer_km),
            "EVENT_TYPE": "STOPPED",
            "CREATED_AT": event_ts,
        }

    # engine on => choose DRIVING/IDLE/STOPPED
    r = random.random()
    if r < P_GO_DRIVING_IF_ON:
        target = sample_speed_kmh(s.category, s.trip_type)
        if s.prev_speed_kmh is None:
            speed = target * random.uniform(0.6, 0.9)
        else:
            speed = s.speed_kmh + (target - s.speed_kmh) * random.uniform(0.15, 0.35)
        speed = clamp(speed, 0.0, 160.0)
        ev = "DRIVING"
    elif r < P_GO_DRIVING_IF_ON + P_GO_IDLE_IF_ON:
        speed = random.uniform(0.0, 7.0)
        ev = "IDLE"
    else:
        speed = 0.0
        ev = "STOPPED"

    acc = compute_acc_ms2(s.speed_kmh, speed, dt_s)
    brake = brake_pressure_bar(acc)

    # move
    dist_km = speed * dt_s / 3600.0
    bearing = random.uniform(0, 2 * math.pi)
    dlat = (dist_km / 111.0) * math.cos(bearing)
    dlon = (dist_km / (111.0 * max(0.2, math.cos(math.radians(s.lat))))) * math.sin(bearing)

    city_lat, city_lon = city_center(s.city)
    drift_lat = (city_lat - s.lat) * 0.02
    drift_lon = (city_lon - s.lng) * 0.02

    new_lat = s.lat + dlat + drift_lat
    new_lng = s.lng + dlon + drift_lon

    true_dist = haversine_km(s.lat, s.lng, new_lat, new_lng)
    s.odometer_km += true_dist

    # fuel/temp
    s.fuel_pct = update_fuel_pct(s.fuel_pct, s.category, speed, dt_s)
    s.engine_temp_c = simulate_engine_temp(s.engine_temp_c, speed, True)

    # update last
    s.prev_speed_kmh = s.speed_kmh
    s.speed_kmh = speed
    s.lat, s.lng = new_lat, new_lng

    return {
        "DEVICE_ID": s.device_id,
        "CAR_ID": s.car_id,
        "EVENT_TS": event_ts,
        "LATITUDE": s.lat,
        "LONGITUDE": s.lng,
        "SPEED_KMH": float(speed),
        "ACCELERATION_MS2": float(acc),
        "BRAKE_PRESSURE_BAR": float(brake),
        "FUEL_LEVEL_PCT": float(s.fuel_pct),
        "BATTERY_VOLTAGE": float(simulate_battery_voltage(True)),
        "ENGINE_TEMP_C": float(s.engine_temp_c),
        "ODOMETER_KM": float(s.odometer_km),
        "EVENT_TYPE": ev,
        "CREATED_AT": event_ts,
    }


# ==============================
# MAIN LOOP
# ==============================

def main():
    random.seed(42)
    print("📡 LIVE IoT SIMULATOR STARTED")
    print(f"⏱ Tick={TICK_SEC}s | SPEEDUP={SPEEDUP}x | history={WRITE_HISTORY_IOT_TELEMETRY}")

    with engine.begin() as conn:
        alter_schema(conn)
        ensure_rt_table_exists(conn)
        ensure_iot_alerts_table_exists(conn)

        supervisor_id = load_supervisor_id(conn)
        customers = load_customers(conn)
        cars_df = load_cars(conn)

        if cars_df.empty:
            raise RuntimeError("No cars with DEVICE_ID found")

        if RESET_ON_START:
            reset_tables(conn)
            print("🧹 Reset done (RT_IOT_FEED, IOT_ALERTS, optional rentals/history)")

    # Keep in-memory states
    states = init_state_from_cars(cars_df)

    while True:
        tick_start = time.time()

        rows = []
        now_ts = datetime.now()

        # generate one row per car per tick
        for car_id, st in states.items():
            row = tick_one_car(st, TICK_SEC)
            row["RECEIVED_AT"] = now_ts  # unify same tick timestamp
            rows.append(row)

        df = pd.DataFrame(rows)
        to_upper_cols(df)

        with engine.begin() as conn:
            alter_schema(conn)

            # For each car, manage rentals + alerts, and set RENTAL_ID in telemetry
            rental_ids_for_rows = []

            for _, r in df.iterrows():
                car_id = int(r["CAR_ID"])
                ev = str(r["EVENT_TYPE"] or "").upper()
                ts = r["EVENT_TS"]
                odo = float(r["ODOMETER_KM"])

                speed = safe_num(r.get("SPEED_KMH"))
                temp = safe_num(r.get("ENGINE_TEMP_C"))
                fuel = safe_num(r.get("FUEL_LEVEL_PCT"))
                brake = safe_num(r.get("BRAKE_PRESSURE_BAR"))

                st = states.get(car_id)
                if not st:
                    rental_ids_for_rows.append(None)
                    continue

                # current active rental for this car (ACTIVE or IN_PROGRESS)
                active_rental = get_active_rental(conn, car_id)

                # CREATE (only if car is truly free: AVAILABLE + no active rental)
                if ev == "ENGINE_START" and not active_rental:
                    if is_car_available_for_rental(conn, car_id):
                        rid = create_rental(
                            conn,
                            car_id=car_id,
                            branch_id=st.branch_id,
                            customer_id=random.choice(customers),
                            manager_id=supervisor_id,
                            start_ts=ts,
                            start_odo=odo,
                            category=st.category,
                        )
                        active_rental = rid
                    else:
                        # car is already rented (manual or simulator) -> do NOT create a new rental
                        active_rental = get_active_rental(conn, car_id)

                # CLOSE
                if ev == "ENGINE_STOP" and active_rental:
                    close_rental(
                        conn,
                        rental_id=active_rental,
                        car_id=car_id,
                        end_ts=ts,
                        end_odo=odo,
                    )
                    active_rental = None

                # alerts (use active rental at moment of event)
                detect_alerts(
                    conn,
                    car_id=car_id,
                    branch_id=st.branch_id,
                    rental_id=active_rental,
                    speed=speed, temp=temp, fuel=fuel, brake=brake,
                    event_ts=ts,
                )

                rental_ids_for_rows.append(active_rental)

            # ✅ set RENTAL_ID column so reports can filter exactly
            df["RENTAL_ID"] = rental_ids_for_rows

            # choose columns for RT
            df_to_insert = df[[
                "DEVICE_ID", "CAR_ID", "RENTAL_ID", "EVENT_TS",
                "LATITUDE", "LONGITUDE",
                "SPEED_KMH", "ACCELERATION_MS2", "BRAKE_PRESSURE_BAR",
                "FUEL_LEVEL_PCT", "BATTERY_VOLTAGE", "ENGINE_TEMP_C",
                "ODOMETER_KM", "EVENT_TYPE", "CREATED_AT", "RECEIVED_AT"
            ]].copy()

            # write RT_IOT_FEED
            df_to_insert.to_sql(
                "RT_IOT_FEED",
                conn,
                schema=SCHEMA,
                if_exists="append",
                index=False,
                chunksize=2000,
            )

            # optional history
            if WRITE_HISTORY_IOT_TELEMETRY:
                hist = df_to_insert.drop(columns=["RECEIVED_AT"]).copy()
                hist.to_sql(
                    "IOT_TELEMETRY",
                    conn,
                    schema=SCHEMA,
                    if_exists="append",
                    index=False,
                    chunksize=2000,
                )

        print(f"✅ Tick wrote {len(df):,} rows | {now_ts.strftime('%H:%M:%S')}")

        elapsed = time.time() - tick_start
        sleep_s = max(0.1, (TICK_SEC / float(SPEEDUP)) - elapsed)
        time.sleep(sleep_s)

if __name__ == "__main__":
    main()

