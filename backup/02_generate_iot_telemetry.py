# 02_generate_iot_telementry.py
# =============================================================================
# Generates REALISTIC + COHERENT IoT telemetry for the NEXT 7 DAYS
# ✅ DOES NOT create RENTALS
# ✅ DOES NOT update CARS status or odometer
# - Writes into IOT_TELEMETRY (RENTAL_ID = NULL)
# - Optionally fills RT_IOT_FEED as "live buffer"
#
# Run:
#   python 02_generate_week_iot_only.py
# =============================================================================

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, time, date
from typing import List, Tuple, Optional

import pandas as pd
from sqlalchemy import create_engine, text

# =============================================================================
# CONFIG
# =============================================================================

ORACLE_URL = "oracle+oracledb://"
CONNECT_ARGS = {"user": "raw_layer", "password": "Raw#123", "dsn": "localhost:1521/XEPDB1"}

RANDOM_SEED = 42

DAYS_FORWARD = 7
ANCHOR_NOW_PLUS_MIN = 5

# Telemetry frequency
# NOTE: 15 seconds = 4 points/minute (high volume)
IOT_INTERVAL_SECONDS = 15

DAY_START_HOUR = 7
DAY_END_HOUR = 21

# Trips/day (per car that is "active")
P_NO_TRIP = 0.35
P_ONE_TRIP = 0.50
P_TWO_TRIPS = 0.15
TRIP_DURATION_MIN_MIN = 12
TRIP_DURATION_MIN_MAX = 75

# "Rental duration" concept kept فقط للتخطيط, لكن بدون Rentals table
RENTAL_DURATION_OPTIONS = [1, 2, 3, 4]
RENTAL_DURATION_WEIGHTS = [0.45, 0.30, 0.18, 0.07]

PROB_CAR_NOT_RENTED_THIS_WEEK = 0.35  # some cars stay idle (no trips)

FILL_RT_IOT_FEED = True
RT_KEEP_LAST_N_ROWS_PER_CAR = 300

RESET_BEFORE_RUN = True   # only clears IoT tables now (NOT RENTALS)

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

ENGINE = create_engine(ORACLE_URL, connect_args=CONNECT_ARGS, pool_pre_ping=True)

# =============================================================================
# HELPERS
# =============================================================================

def set_seed():
    random.seed(RANDOM_SEED)

def now_anchor() -> datetime:
    dt = datetime.now() + timedelta(minutes=ANCHOR_NOW_PLUS_MIN)
    if dt.hour >= DAY_END_HOUR or dt.hour < DAY_START_HOUR:
        tomorrow = (dt + timedelta(days=1)).date()
        dt = datetime.combine(tomorrow, time(9, 0))
    print(f"⏱️ Anchor start = {dt}")
    return dt

def get_city_center(city: str) -> Tuple[float, float]:
    city_u = (city or "CASABLANCA").upper()
    return CITY_COORDS.get(city_u, CITY_COORDS["CASABLANCA"])

def haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat/2)**2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def clamp(x, lo, hi):
    return max(lo, min(hi, x))

def pick_trip_type() -> str:
    r = random.random()
    if r < 0.55:
        return "city"
    elif r < 0.85:
        return "mixed"
    return "highway"

def sample_speed_kmh(category_name: str, trip_type: str) -> float:
    prof = CATEGORY_SPEED_PROFILE.get(category_name.upper(), CATEGORY_SPEED_PROFILE["ECONOMY"])
    vmin, vmax = prof[trip_type]
    return random.uniform(vmin, vmax)

def compute_acc_ms2(prev_speed_kmh: Optional[float], speed_kmh: float, dt_s: int) -> float:
    if prev_speed_kmh is None:
        return 0.0
    v1 = prev_speed_kmh / 3.6
    v2 = speed_kmh / 3.6
    return (v2 - v1) / dt_s

def brake_pressure_bar(acc_ms2: float) -> float:
    if acc_ms2 < -2.5:
        return random.uniform(35, 80)
    if acc_ms2 < -1.0:
        return random.uniform(10, 35)
    return random.uniform(0, 4)

def simulate_battery_voltage(engine_on: bool) -> float:
    return random.uniform(13.5, 14.4) if engine_on else random.uniform(12.2, 12.9)

def simulate_engine_temp(prev: Optional[float], speed_kmh: float, engine_on: bool) -> float:
    if not engine_on:
        if prev is None:
            return 25.0
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

def random_start_time_for_day(day: date, win_start: datetime | None = None) -> datetime:
    start_min = DAY_START_HOUR * 60
    end_min = (DAY_END_HOUR - 1) * 60
    m = random.randint(start_min, end_min)
    dt = datetime.combine(day, time(0, 0)) + timedelta(minutes=m)
    if win_start is not None and dt < win_start:
        dt = win_start
    return dt

def sample_rental_days(max_days: int) -> int:
    options, weights = [], []
    for d, w in zip(RENTAL_DURATION_OPTIONS, RENTAL_DURATION_WEIGHTS):
        if d <= max_days:
            options.append(d)
            weights.append(w)
    if not options:
        return max(1, max_days)

    total = sum(weights)
    r = random.random() * total
    cum = 0.0
    for d, w in zip(options, weights):
        cum += w
        if r <= cum:
            return d
    return options[-1]

# =============================================================================
# DB FETCH
# =============================================================================

def fetch_df(sql: str, params: dict | None = None) -> pd.DataFrame:
    with ENGINE.connect() as conn:
        return pd.read_sql(text(sql), conn, params=params or {})

def load_reference_data():
    branches = fetch_df("""
        SELECT BRANCH_ID, BRANCH_NAME, CITY
        FROM BRANCHES
        ORDER BY BRANCH_ID
    """)

    cars = fetch_df("""
        SELECT
            c.CAR_ID,
            c.BRANCH_ID,
            b.CITY,
            b.BRANCH_NAME,
            c.DEVICE_ID,
            c.ODOMETER_KM,
            c.STATUS AS CAR_STATUS,
            cat.CATEGORY_NAME
        FROM CARS c
        JOIN BRANCHES b ON b.BRANCH_ID = c.BRANCH_ID
        JOIN CAR_CATEGORIES cat ON cat.CATEGORY_ID = c.CATEGORY_ID
        WHERE c.DEVICE_ID IS NOT NULL
        ORDER BY c.BRANCH_ID, c.CAR_ID
    """)

    for df in [branches, cars]:
        df.columns = [c.upper().strip() for c in df.columns]

    return branches, cars

# =============================================================================
# RESET (OPTIONAL)
# =============================================================================

def reset_before_run():
    if not RESET_BEFORE_RUN:
        return
    with ENGINE.begin() as conn:
        conn.execute(text("DELETE FROM RT_IOT_FEED"))
        conn.execute(text("DELETE FROM IOT_TELEMETRY"))
    print("🧹 RESET done: cleared RT_IOT_FEED, IOT_TELEMETRY (RENTALS untouched).")

# =============================================================================
# "PLAN" ONLY (NO RENTALS)
# =============================================================================

@dataclass
class ActivityPlan:
    branch_id: int
    car_id: int
    device_id: int
    category: str
    start_at: datetime
    end_at: datetime
    start_odo: float

def build_week_activity_plans(anchor: datetime, cars: pd.DataFrame) -> List[ActivityPlan]:
    plans: List[ActivityPlan] = []
    sim_start = anchor
    sim_end = anchor + timedelta(days=DAYS_FORWARD)

    for branch_id, cars_b in cars.groupby("BRANCH_ID"):
        cars_b = cars_b.copy()

        active_mask = [random.random() > PROB_CAR_NOT_RENTED_THIS_WEEK for _ in range(len(cars_b))]
        cars_active = cars_b.loc[active_mask]

        if cars_active.empty:
            cars_active = cars_b.sample(1)

        print(f"🏢 Branch {int(branch_id)} -> cars with activity: {len(cars_active)}/{len(cars_b)}")

        for _, car in cars_active.iterrows():
            car_id = int(car["CAR_ID"])
            device_id = int(car["DEVICE_ID"])
            category = str(car["CATEGORY_NAME"])
            start_odo = float(car["ODOMETER_KM"] or 0.0)

            n_blocks = 1 if random.random() < 0.70 else 2
            cursor_day = 0

            for _ in range(n_blocks):
                remaining_days = DAYS_FORWARD - cursor_day
                if remaining_days <= 0:
                    break

                gap = random.randint(0, 1)
                cursor_day += gap
                if cursor_day >= DAYS_FORWARD:
                    break

                remaining_days = DAYS_FORWARD - cursor_day
                dur_days = sample_rental_days(remaining_days)

                day0 = (sim_start + timedelta(days=cursor_day)).date()
                win_start = sim_start if day0 == sim_start.date() else None
                start_at = random_start_time_for_day(day0, win_start=win_start)

                end_at = start_at + timedelta(days=dur_days)
                if end_at > sim_end:
                    end_at = sim_end

                plans.append(ActivityPlan(
                    branch_id=int(branch_id),
                    car_id=car_id,
                    device_id=device_id,
                    category=category,
                    start_at=start_at,
                    end_at=end_at,
                    start_odo=start_odo,
                ))

                cursor_day += max(1, dur_days)

    # Force at least one activity at anchor
    if not plans:
        raise RuntimeError("No activity plans generated (unexpected).")

    p0 = plans[0]
    plans[0] = ActivityPlan(
        branch_id=p0.branch_id,
        car_id=p0.car_id,
        device_id=p0.device_id,
        category=p0.category,
        start_at=anchor,
        end_at=min(anchor + timedelta(days=2), sim_end),
        start_odo=p0.start_odo,
    )

    plans.sort(key=lambda x: (x.start_at, x.branch_id, x.car_id))
    return plans

# =============================================================================
# TELEMETRY GENERATION (RENTAL_ID=NULL)
# =============================================================================

def generate_trip_telemetry(
    device_id: int,
    car_id: int,
    rental_id: Optional[int],
    category: str,
    city: str,
    start_dt: datetime,
    duration_min: int,
    start_lat: float,
    start_lon: float,
    start_odo: float,
    start_fuel: float,
) -> Tuple[List[dict], float, float, float, float]:

    trip_type = pick_trip_type()
    steps = max(1, int((duration_min * 60) / IOT_INTERVAL_SECONDS))

    rows: List[dict] = []
    ts = start_dt
    lat, lon = start_lat, start_lon
    odo = start_odo
    fuel = start_fuel
    eng_temp = None
    prev_speed = None

    rows.append({
        "DEVICE_ID": device_id,
        "CAR_ID": car_id,
        "RENTAL_ID": rental_id,  # NULL
        "EVENT_TS": ts,
        "LATITUDE": lat,
        "LONGITUDE": lon,
        "SPEED_KMH": 0.0,
        "ACCELERATION_MS2": 0.0,
        "BRAKE_PRESSURE_BAR": 0.0,
        "FUEL_LEVEL_PCT": float(fuel),
        "BATTERY_VOLTAGE": float(simulate_battery_voltage(True)),
        "ENGINE_TEMP_C": float(simulate_engine_temp(eng_temp, 0.0, True)),
        "ODOMETER_KM": float(odo),
        "EVENT_TYPE": "ENGINE_START",
    })

    for _ in range(1, steps + 1):
        ts = ts + timedelta(seconds=IOT_INTERVAL_SECONDS)

        target_speed = sample_speed_kmh(category, trip_type)
        if prev_speed is None:
            speed = target_speed * random.uniform(0.6, 0.9)
        else:
            speed = prev_speed + (target_speed - prev_speed) * random.uniform(0.15, 0.35)
        speed = clamp(speed, 0.0, 160.0)

        dist_km = speed * IOT_INTERVAL_SECONDS / 3600.0

        bearing = random.uniform(0, 2 * math.pi)
        dlat = (dist_km / 111.0) * math.cos(bearing)
        dlon = (dist_km / (111.0 * max(0.2, math.cos(math.radians(lat))))) * math.sin(bearing)

        city_lat, city_lon = get_city_center(city)
        drift_lat = (city_lat - lat) * 0.02
        drift_lon = (city_lon - lon) * 0.02

        new_lat = lat + dlat + drift_lat
        new_lon = lon + dlon + drift_lon

        true_dist = haversine_km(lat, lon, new_lat, new_lon)
        odo += true_dist

        acc = compute_acc_ms2(prev_speed, speed, IOT_INTERVAL_SECONDS)
        prev_speed = speed

        fuel = update_fuel_pct(fuel, category, speed, IOT_INTERVAL_SECONDS)
        eng_temp = simulate_engine_temp(eng_temp, speed, True)
        bpress = brake_pressure_bar(acc)

        rows.append({
            "DEVICE_ID": device_id,
            "CAR_ID": car_id,
            "RENTAL_ID": rental_id,
            "EVENT_TS": ts,
            "LATITUDE": new_lat,
            "LONGITUDE": new_lon,
            "SPEED_KMH": float(speed),
            "ACCELERATION_MS2": float(acc),
            "BRAKE_PRESSURE_BAR": float(bpress),
            "FUEL_LEVEL_PCT": float(fuel),
            "BATTERY_VOLTAGE": float(simulate_battery_voltage(True)),
            "ENGINE_TEMP_C": float(eng_temp),
            "ODOMETER_KM": float(odo),
            "EVENT_TYPE": "DRIVING" if speed >= 5 else "IDLE",
        })

        lat, lon = new_lat, new_lon

    ts = ts + timedelta(seconds=IOT_INTERVAL_SECONDS)
    rows.append({
        "DEVICE_ID": device_id,
        "CAR_ID": car_id,
        "RENTAL_ID": rental_id,
        "EVENT_TS": ts,
        "LATITUDE": lat,
        "LONGITUDE": lon,
        "SPEED_KMH": 0.0,
        "ACCELERATION_MS2": 0.0,
        "BRAKE_PRESSURE_BAR": 0.0,
        "FUEL_LEVEL_PCT": float(fuel),
        "BATTERY_VOLTAGE": float(simulate_battery_voltage(False)),
        "ENGINE_TEMP_C": float(simulate_engine_temp(eng_temp, 0.0, False)),
        "ODOMETER_KM": float(odo),
        "EVENT_TYPE": "ENGINE_STOP",
    })

    if fuel < 12.0 and CATEGORY_FUEL_CONS.get(category.upper(), 0.0) > 0:
        ts = ts + timedelta(minutes=8)
        fuel = 100.0
        rows.append({
            "DEVICE_ID": device_id,
            "CAR_ID": car_id,
            "RENTAL_ID": rental_id,
            "EVENT_TS": ts,
            "LATITUDE": lat,
            "LONGITUDE": lon,
            "SPEED_KMH": 0.0,
            "ACCELERATION_MS2": 0.0,
            "BRAKE_PRESSURE_BAR": 0.0,
            "FUEL_LEVEL_PCT": float(fuel),
            "BATTERY_VOLTAGE": float(simulate_battery_voltage(False)),
            "ENGINE_TEMP_C": float(simulate_engine_temp(eng_temp, 0.0, False)),
            "ODOMETER_KM": float(odo),
            "EVENT_TYPE": "REFUEL",
        })

    return rows, odo, fuel, lat, lon

def generate_activity_telemetry(plan: ActivityPlan, city: str) -> Tuple[List[dict], float]:
    rows: List[dict] = []

    device_id = plan.device_id
    car_id = plan.car_id
    category = plan.category
    start = plan.start_at
    end = plan.end_at

    lat, lon = get_city_center(city)
    odo = float(plan.start_odo)
    fuel = 100.0

    # Marker: ACTIVITY_START (not a rental)
    rows.append({
        "DEVICE_ID": device_id,
        "CAR_ID": car_id,
        "RENTAL_ID": None,
        "EVENT_TS": start,
        "LATITUDE": lat,
        "LONGITUDE": lon,
        "SPEED_KMH": 0.0,
        "ACCELERATION_MS2": 0.0,
        "BRAKE_PRESSURE_BAR": 0.0,
        "FUEL_LEVEL_PCT": float(fuel),
        "BATTERY_VOLTAGE": float(simulate_battery_voltage(False)),
        "ENGINE_TEMP_C": 25.0,
        "ODOMETER_KM": float(odo),
        "EVENT_TYPE": "ACTIVITY_START",
    })

    cur_day = start.date()
    last_day = end.date()

    while cur_day <= last_day:
        day_start = datetime.combine(cur_day, time(DAY_START_HOUR, 0))
        day_end = datetime.combine(cur_day, time(DAY_END_HOUR, 0))

        win_start = max(day_start, start)
        win_end = min(day_end, end)

        if win_start < win_end:
            r = random.random()
            if r < P_NO_TRIP:
                trips_today = 0
            elif r < P_NO_TRIP + P_ONE_TRIP:
                trips_today = 1
            else:
                trips_today = 2

            for _ in range(trips_today):
                if (win_end - win_start).total_seconds() < 30 * 60:
                    continue

                t0 = win_start + timedelta(
                    minutes=random.randint(0, int((win_end - win_start).total_seconds() // 60) - 20)
                )
                dur = random.randint(TRIP_DURATION_MIN_MIN, TRIP_DURATION_MIN_MAX)

                if t0 + timedelta(minutes=dur) > win_end:
                    dur = max(10, int((win_end - t0).total_seconds() // 60) - 2)
                if dur < 10:
                    continue

                trip_rows, odo, fuel, lat, lon = generate_trip_telemetry(
                    device_id=device_id,
                    car_id=car_id,
                    rental_id=None,
                    category=category,
                    city=city,
                    start_dt=t0,
                    duration_min=dur,
                    start_lat=lat,
                    start_lon=lon,
                    start_odo=odo,
                    start_fuel=fuel,
                )
                rows.extend(trip_rows)

        cur_day += timedelta(days=1)

    rows.append({
        "DEVICE_ID": device_id,
        "CAR_ID": car_id,
        "RENTAL_ID": None,
        "EVENT_TS": end,
        "LATITUDE": lat,
        "LONGITUDE": lon,
        "SPEED_KMH": 0.0,
        "ACCELERATION_MS2": 0.0,
        "BRAKE_PRESSURE_BAR": 0.0,
        "FUEL_LEVEL_PCT": float(fuel),
        "BATTERY_VOLTAGE": float(simulate_battery_voltage(False)),
        "ENGINE_TEMP_C": 25.0,
        "ODOMETER_KM": float(odo),
        "EVENT_TYPE": "ACTIVITY_END",
    })

    return rows, odo

def ensure_immediate_activity(car_id: int, device_id: int, category: str, city: str, anchor: datetime, start_odo: float) -> List[dict]:
    lat, lon = get_city_center(city)
    t0 = anchor + timedelta(minutes=2)
    dur = random.randint(10, 15)

    rows, *_ = generate_trip_telemetry(
        device_id=device_id,
        car_id=car_id,
        rental_id=None,
        category=category,
        city=city,
        start_dt=t0,
        duration_min=dur,
        start_lat=lat,
        start_lon=lon,
        start_odo=float(start_odo),
        start_fuel=100.0,
    )
    return rows

# =============================================================================
# WRITE
# =============================================================================

def write_telemetry_rows(conn, rows: List[dict]):
    if not rows:
        return
    df = pd.DataFrame(rows)
    df.sort_values(["EVENT_TS", "CAR_ID", "DEVICE_ID"], inplace=True)
    df["CREATED_AT"] = df["EVENT_TS"]

    df_db = df[[
        "DEVICE_ID","CAR_ID","RENTAL_ID","EVENT_TS","LATITUDE","LONGITUDE",
        "SPEED_KMH","ACCELERATION_MS2","BRAKE_PRESSURE_BAR","FUEL_LEVEL_PCT",
        "BATTERY_VOLTAGE","ENGINE_TEMP_C","ODOMETER_KM","EVENT_TYPE","CREATED_AT"
    ]].copy()

    df_db.to_sql("IOT_TELEMETRY", conn, if_exists="append", index=False, chunksize=5000)

    if FILL_RT_IOT_FEED:
        rt_rows = []
        for car_id, g in df.groupby("CAR_ID"):
            g = g.sort_values("EVENT_TS").tail(RT_KEEP_LAST_N_ROWS_PER_CAR)
            rt_rows.append(g)
        rt = pd.concat(rt_rows, ignore_index=True)

        rt_db = rt[[
            "DEVICE_ID","CAR_ID","RENTAL_ID","EVENT_TS","LATITUDE","LONGITUDE",
            "SPEED_KMH","ACCELERATION_MS2","BRAKE_PRESSURE_BAR","FUEL_LEVEL_PCT",
            "BATTERY_VOLTAGE","ENGINE_TEMP_C","ODOMETER_KM","EVENT_TYPE","CREATED_AT"
        ]].copy()

        rt_db.insert(0, "TELEMETRY_ID", None)
        rt_db.to_sql("RT_IOT_FEED", conn, if_exists="append", index=False, chunksize=5000)

# =============================================================================
# MAIN
# =============================================================================

def main():
    set_seed()
    reset_before_run()

    anchor = now_anchor()
    sim_end = anchor + timedelta(days=DAYS_FORWARD)
    print(f"📅 Simulating IoT ONLY next week: {anchor} -> {sim_end}")

    branches, cars = load_reference_data()
    if cars.empty:
        raise RuntimeError("No cars with devices found (CARS.DEVICE_ID IS NULL).")

    plans = build_week_activity_plans(anchor, cars)
    print(f"🧾 Activity plans generated: {len(plans)}")

    total_rows = 0

    with ENGINE.begin() as conn:
        if not RESET_BEFORE_RUN and FILL_RT_IOT_FEED:
            conn.execute(text("DELETE FROM RT_IOT_FEED"))

        forced_done = False

        for plan in plans:
            branch_city = str(branches.loc[branches["BRANCH_ID"] == plan.branch_id, "CITY"].iloc[0])

            tele_rows, _final_odo = generate_activity_telemetry(plan, branch_city)

            # ensure some immediate activity right after run (only once)
            if not forced_done and plan.start_at == anchor:
                tele_rows.extend(ensure_immediate_activity(
                    car_id=plan.car_id,
                    device_id=plan.device_id,
                    category=plan.category,
                    city=branch_city,
                    anchor=anchor,
                    start_odo=plan.start_odo,
                ))
                forced_done = True

            write_telemetry_rows(conn, tele_rows)
            total_rows += len(tele_rows)

            print(f"✅ CAR_ID={plan.car_id} | BRANCH={plan.branch_id} | tele={len(tele_rows)} rows")

    print("=============================================================")
    print("🎉 Done. IoT telemetry generated (NO RENTALS created).")
    print(f"📈 Telemetry rows inserted: {total_rows:,}")
    print(f"🗓️ Window: {anchor} -> {sim_end}")
    print("=============================================================")

if __name__ == "__main__":
    main()
