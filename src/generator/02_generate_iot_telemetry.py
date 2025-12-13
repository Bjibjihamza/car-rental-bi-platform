# 02_generate_iot_telemetry.py
# ============================================================
# Generate synthetic IoT telemetry and write it directly
# into Oracle table IOT_TELEMETRY.
#
# BI-friendly version:
#   - Rentals can span multiple days (1, 2, 3, 5, 7, 10, 14 days).
#   - For a given CAR_ID + RENTAL_ID, the rental may cover several days.
#   - Distance GPS, SPEED_KMH and ODOMETER_KM are coherent.
#   - In ~70% of days, there is NO driving between 04:00–08:00 and 14:00–16:00.
#   - Some cars are barely or never rented (fleet realism).
#
# Date logic:
#   - If IOT_TELEMETRY already has data:
#       start_date = (max(EVENT_TS).date() + 1 day)
#   - Else:
#       start_date = date.today()
#   - Then we simulate DAYS_FORWARD days (~1 month)
#   - Before insert, we TRUNCATE IOT_TELEMETRY
# ============================================================

import os
import math
import random
from datetime import datetime, timedelta, date

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

import osmnx as ox
import networkx as nx

# ============================================================
# CONFIG
# ============================================================

ORACLE_USER = "raw_layer"
ORACLE_PWD = "Raw#123"
ORACLE_DSN = "localhost:1521/XEPDB1"

RANDOM_SEED = 42                # reproductible
IOT_INTERVAL_SECONDS = 30       # fréquence IoT
DAYS_FORWARD = 31               # ~1 mois glissant

# Fenêtre globale de conduite (hard) – “jamais” hors de ça
DAY_START_HOUR = 7   # 07h00
DAY_END_HOUR = 21    # 21h00

# Fenêtres “soft” (pas de conduite dans 70% des cas)
SOFT_FORBIDDEN_WINDOWS = [
    (4, 8),   # 04:00–08:00 (matin très tôt)
    (14, 16)  # 14:00–16:00 (après déjeuner)
]
PROB_AVOID_FORBIDDEN = 0.7  # 70% des jours : on évite ces fenêtres

# Probabilités de trajets par jour (quand la voiture est louée)
P_NO_TRIP = 0.4      # 40% des jours sans trajet
P_ONE_TRIP = 0.45    # 45% des jours avec 1 trajet
P_TWO_TRIPS = 0.15   # 15% des jours avec 2 trajets

# Durée d'un trajet (en minutes)
TRIP_DURATION_MIN_MIN = 15
TRIP_DURATION_MIN_MAX = 90

# Durées possibles d'une location (en jours) + poids
RENTAL_DURATION_OPTIONS = [1, 2, 3, 5, 7, 10, 14]
RENTAL_DURATION_WEIGHTS = [0.3, 0.2, 0.15, 0.15, 0.1, 0.05, 0.05]

# Certains cars ne seront JAMAIS loués du mois
PROB_CAR_NEVER_RENTED = 0.15   # 15% de la flotte “parking only”

# Profils de vitesse par catégorie (km/h)
CATEGORY_SPEED_PROFILE = {
    "ECONOMY": {"city": (20, 60), "mixed": (30, 80), "highway": (70, 110)},
    "SUV":     {"city": (20, 60), "mixed": (30, 90), "highway": (80, 130)},
    "LUXURY":  {"city": (20, 60), "mixed": (40, 100), "highway": (90, 140)},
    "VAN":     {"city": (15, 50), "mixed": (30, 80), "highway": (70, 120)},
    "ELECTRIC":{"city": (20, 60), "mixed": (30, 80), "highway": (70, 120)},
}

# Coordonnées approximatives des villes pour simuler la position
CITY_COORDS = {
    "CASABLANCA": (33.5731, -7.5898),
    "RABAT":      (34.0209, -6.8416),
    "MARRAKECH":  (31.6295, -7.9811),
    "TANGER":     (35.7595, -5.8340),
    "AGADIR":     (30.4278, -9.5981),
}

# Consommation carburant approximative par catégorie (litres / 100km)
CATEGORY_FUEL_CONS = {
    "ECONOMY": 6.0,
    "SUV": 8.5,
    "LUXURY": 9.5,
    "VAN": 9.0,
    "ELECTRIC": 0.0,  # géré différemment si besoin
}

# Capacité réservoir (L) par catégorie (pour calculer %)
CATEGORY_TANK_SIZE = {
    "ECONOMY": 45,
    "SUV": 60,
    "LUXURY": 65,
    "VAN": 75,
    "ELECTRIC": 0,    # batterie, on garde % direct
}

# ============================================================
# DB CONNECTION
# ============================================================

engine = create_engine(
    "oracle+oracledb://",
    connect_args={"user": ORACLE_USER, "password": ORACLE_PWD, "dsn": ORACLE_DSN},
    pool_pre_ping=True,
)

# ============================================================
# DATE LOGIC: START DATE FROM DB OR TODAY
# ============================================================

def get_start_datetime_now_plus_5min():
    """
    Start telemetry at (now + 5 minutes), regardless of DB content.
    """
    start_dt = datetime.now() + timedelta(minutes=5)
    print(f"⏱️ Run start anchor = now+5min = {start_dt}")
    return start_dt


# ============================================================
# UTILS
# ============================================================

def setup_random_seed():
    random.seed(RANDOM_SEED)


def pick_trip_type():
    r = random.random()
    if r < 0.5:
        return "city"
    elif r < 0.8:
        return "mixed"
    else:
        return "highway"


def sample_speed(category_name, trip_type):
    prof = CATEGORY_SPEED_PROFILE.get(category_name.upper(), CATEGORY_SPEED_PROFILE["ECONOMY"])
    vmin, vmax = prof[trip_type]
    return random.uniform(vmin, vmax)


def compute_acceleration(prev_speed_kmh, speed_kmh, dt_seconds):
    if prev_speed_kmh is None:
        return 0.0
    v1 = prev_speed_kmh / 3.6
    v2 = speed_kmh / 3.6
    return (v2 - v1) / dt_seconds


def compute_brake_pressure(acc_ms2):
    if acc_ms2 < -2.5:
        return random.uniform(40, 80)
    elif acc_ms2 < -1.0:
        return random.uniform(10, 40)
    else:
        return random.uniform(0, 5)


def update_fuel_level(fuel_pct, category_name, speed_kmh, dt_seconds):
    if CATEGORY_FUEL_CONS.get(category_name.upper(), 0.0) == 0:
        return fuel_pct

    dist_km = speed_kmh * dt_seconds / 3600.0
    cons_l_per_100 = CATEGORY_FUEL_CONS[category_name.upper()]
    tank_size = CATEGORY_TANK_SIZE[category_name.upper()]
    if tank_size <= 0:
        return fuel_pct

    cons_l = cons_l_per_100 * dist_km / 100.0
    cons_pct = (cons_l / tank_size) * 100.0
    fuel_pct = max(0.0, fuel_pct - cons_pct)
    return fuel_pct


def simulate_engine_temp(prev_temp, speed_kmh, is_engine_on):
    if not is_engine_on:
        if prev_temp is None:
            return 25.0
        return max(25.0, prev_temp - random.uniform(0.1, 0.3))

    if prev_temp is None:
        prev_temp = 40.0

    target = 90.0 if speed_kmh > 20 else 70.0
    delta = (target - prev_temp) * 0.1
    return prev_temp + delta + random.uniform(-1.0, 1.0)


def simulate_battery_voltage(is_engine_on):
    if is_engine_on:
        return random.uniform(13.5, 14.3)
    else:
        return random.uniform(12.2, 12.8)


def get_city_center(city):
    city_u = (city or "").upper()
    return CITY_COORDS.get(city_u, CITY_COORDS["CASABLANCA"])


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def sample_rental_duration(max_days: int) -> int:
    options = []
    weights = []
    for d, w in zip(RENTAL_DURATION_OPTIONS, RENTAL_DURATION_WEIGHTS):
        if d <= max_days:
            options.append(d)
            weights.append(w)

    if not options:
        return max(1, max_days)

    total_w = sum(weights)
    r = random.random() * total_w
    cum = 0.0
    for d, w in zip(options, weights):
        cum += w
        if r <= cum:
            return d
    return options[-1]

# ============================================================
# TIME WINDOWS (70% NO DRIVING IN 04–08 & 14–16)
# ============================================================

def build_allowed_windows_for_day():
    """
    Retourne une liste de fenêtres horaires (start_h, end_h) dans
    lesquelles on PEUT démarrer un trajet ce jour-là.
    - Hard window : [DAY_START_HOUR, DAY_END_HOUR]
    - 70% des jours : on évite 04–08 et 14–16.
    """
    base_start = DAY_START_HOUR
    base_end = DAY_END_HOUR

    avoid = random.random() < PROB_AVOID_FORBIDDEN

    if not avoid:
        return [(base_start, base_end)]

    windows = []

    # Segment 1 : [8, 14]
    seg1_start = max(base_start, 8)
    seg1_end = min(base_end, 14)
    if seg1_start < seg1_end:
        windows.append((seg1_start, seg1_end))

    # Segment 2 : [16, 21]
    seg2_start = max(base_start, 16)
    seg2_end = base_end
    if seg2_start < seg2_end:
        windows.append((seg2_start, seg2_end))

    if not windows:
        windows = [(base_start, base_end)]

    return windows


def sample_start_minute_from_windows(windows):
    """
    windows : liste de tuples (start_h, end_h) en heures.
    Retourne un start_minute (minutes depuis 00:00) tiré
    uniformément sur l'union des fenêtres.
    """
    segments = []
    total_minutes = 0

    for (h_start, h_end) in windows:
        m_start = int(h_start * 60)
        m_end = int(h_end * 60)
        if m_end <= m_start:
            continue
        length = m_end - m_start
        segments.append((m_start, m_end, length))
        total_minutes += length

    if not segments:
        m_start = DAY_START_HOUR * 60
        m_end = DAY_END_HOUR * 60
        return random.randint(m_start, m_end - 30)

    r = random.randint(0, total_minutes - 1)
    cum = 0
    for (m_start, m_end, length) in segments:
        if r < cum + length:
            offset = r - cum
            return m_start + offset
        cum += length

    m_start, m_end, _ = segments[-1]
    return random.randint(m_start, m_end - 30)

# ============================================================
# OSM / ROUTING HELPERS
# ============================================================

_CITY_GRAPHS = {}

def get_city_graph(city):
    city_u = (city or "").title() + ", Morocco"
    if city_u in _CITY_GRAPHS:
        return _CITY_GRAPHS[city_u]

    print(f"🗺️  Loading road graph for {city_u} from OpenStreetMap...")
    G = ox.graph_from_place(city_u, network_type="drive")
    _CITY_GRAPHS[city_u] = G
    return G


def build_road_route_for_trip(city, steps, lat0, lon0):
    G = get_city_graph(city)

    # Node le plus proche du centre donné
    orig = ox.distance.nearest_nodes(G, lon0, lat0)

    nodes = list(G.nodes)
    dest = orig
    tries = 0
    while dest == orig and tries < 50:
        dest = random.choice(nodes)
        tries += 1

    path_out = None
    if dest is not None and orig is not None:
        try:
            path_out = ox.shortest_path(G, orig, dest, weight="length")
        except Exception:
            path_out = None

    # Si pas de chemin trouvé → on reste sur place
    if not path_out or len(path_out) < 2:
        return [(lat0, lon0)] * (steps + 1)

    # Aller-retour
    path_back = list(reversed(path_out))
    full_path = path_out + path_back[1:]

    coords_path = [(G.nodes[n]["y"], G.nodes[n]["x"]) for n in full_path]

    if len(coords_path) == 1:
        return [(lat0, lon0)] * (steps + 1)

    # Resampling sur "steps" points
    coords_resampled = []
    for i in range(steps + 1):
        idx_float = i * (len(coords_path) - 1) / steps
        idx0 = int(idx_float)
        idx1 = min(idx0 + 1, len(coords_path) - 1)
        alpha = idx_float - idx0

        lat0_seg, lon0_seg = coords_path[idx0]
        lat1_seg, lon1_seg = coords_path[idx1]

        lat = lat0_seg + alpha * (lat1_seg - lat0_seg)
        lon = lon0_seg + alpha * (lon1_seg - lon0_seg)
        coords_resampled.append((lat, lon))

    # On force départ et fin au centre
    coords_resampled[0] = (lat0, lon0)
    coords_resampled[-1] = (lat0, lon0)

    return coords_resampled

# ============================================================
# FETCH CARS & DEVICES FROM DB
# ============================================================

def fetch_cars_with_devices():
    sql = """
        SELECT
            c.CAR_ID,
            c.VIN,
            c.LICENSE_PLATE,
            c.MODEL_YEAR,
            c.ODOMETER_KM,
            c.STATUS,
            c.BRANCH_ID,
            b.BRANCH_NAME,
            b.CITY,
            cat.CATEGORY_NAME,
            d.DEVICE_ID
        FROM CARS c
        LEFT JOIN BRANCHES b ON b.BRANCH_ID = c.BRANCH_ID
        LEFT JOIN CAR_CATEGORIES cat ON cat.CATEGORY_ID = c.CATEGORY_ID
        LEFT JOIN IOT_DEVICES d ON d.DEVICE_ID = c.DEVICE_ID
    """
    with engine.connect() as conn:
        df = pd.read_sql(text(sql), conn)

    if df.empty:
        print("⚠️ fetch_cars_with_devices: la requête ne retourne aucune voiture.")
        return df

    orig_cols = list(df.columns)
    df.columns = [c.upper().strip() for c in df.columns]

    # Normalisation DEVICE_ID
    dev_col = None
    for c in df.columns:
        if c == "DEVICE_ID":
            dev_col = c
            break
    if dev_col is None:
        for c in df.columns:
            if "DEVICE_ID" in c:
                dev_col = c
                break

    if dev_col is None:
        print(f"⚠️ fetch_cars_with_devices: aucune colonne DEVICE_ID trouvée. Colonnes = {orig_cols}")
        df["DEVICE_ID"] = None
    elif dev_col != "DEVICE_ID":
        df.rename(columns={dev_col: "DEVICE_ID"}, inplace=True)

    # Renommage FKs si besoin
    rename_map = {}
    for target in ["CAR_ID", "ODOMETER_KM", "BRANCH_NAME", "CITY", "CATEGORY_NAME"]:
        if target not in df.columns:
            for c in df.columns:
                if target in c:
                    rename_map[c] = target
                    break
    if rename_map:
        df.rename(columns=rename_map, inplace=True)

    df["CITY"] = df.get("CITY", "CASABLANCA").fillna("CASABLANCA")
    df["CATEGORY_NAME"] = df.get("CATEGORY_NAME", "ECONOMY").fillna("ECONOMY")
    df["ODOMETER_KM"] = df.get("ODOMETER_KM", 0).fillna(0).astype(float)

    # Garder seulement les cars avec DEVICE_ID
    df = df[df["DEVICE_ID"].notna()].copy()

    print(f"📦 Loaded {len(df)} cars with IoT devices. (Colonnes réelles: {list(df.columns)})")
    return df

# ============================================================
# TRIP SIMULATION (BI-FRIENDLY)
# ============================================================

def generate_trip_points(
    car_row,
    trip_id,
    trip_start_dt,
    trip_duration_min,
    base_odometer_km,
    initial_fuel_pct,
):
    category = car_row["CATEGORY_NAME"]
    car_id = int(car_row["CAR_ID"])
    device_id = int(car_row["DEVICE_ID"])
    branch_name = car_row["BRANCH_NAME"]
    city = car_row["CITY"]

    lat0, lon0 = get_city_center(city)
    _trip_type = pick_trip_type()

    total_seconds = trip_duration_min * 60
    steps = max(1, total_seconds // IOT_INTERVAL_SECONDS)

    route_coords = build_road_route_for_trip(city, steps, lat0, lon0)
    n_coords = len(route_coords)

    step_dists_km = [0.0]
    for (lat1, lon1), (lat2, lon2) in zip(route_coords[:-1], route_coords[1:]):
        step_dists_km.append(haversine_km(lat1, lon1, lat2, lon2))

    rows = []
    ts = trip_start_dt
    odometer_km = base_odometer_km
    fuel_pct = initial_fuel_pct
    engine_temp = None
    prev_speed_kmh = None

    # ENGINE_START
    lat, lon = route_coords[0]
    speed_kmh = 0.0
    acc_ms2 = 0.0
    brake_pressure = 0.0
    engine_temp = simulate_engine_temp(engine_temp, speed_kmh, is_engine_on=True)
    battery_v = simulate_battery_voltage(is_engine_on=True)

    rows.append(
        dict(
            DEVICE_ID=device_id,
            CAR_ID=car_id,
            RENTAL_ID=trip_id,
            TIMESTAMP=ts,
            LATITUDE=lat,
            LONGITUDE=lon,
            SPEED_KMH=speed_kmh,
            ACCELERATION_MS2=acc_ms2,
            BRAKE_PRESSURE_BAR=brake_pressure,
            FUEL_LEVEL_PCT=fuel_pct,
            BATTERY_VOLTAGE=battery_v,
            ENGINE_TEMP_C=engine_temp,
            ODOMETER_KM=odometer_km,
            EVENT_TYPE="ENGINE_START",
            BRANCH_NAME=branch_name,
            CITY=city,
        )
    )

    for step in range(1, n_coords):
        ts += timedelta(seconds=IOT_INTERVAL_SECONDS)

        dist_km = step_dists_km[step]
        if dist_km > 0:
            speed_kmh = dist_km * 3600.0 / IOT_INTERVAL_SECONDS
        else:
            speed_kmh = 0.0

        acc_ms2 = compute_acceleration(prev_speed_kmh, speed_kmh, IOT_INTERVAL_SECONDS)
        prev_speed_kmh = speed_kmh

        brake_pressure = compute_brake_pressure(acc_ms2)

        odometer_km += dist_km
        fuel_pct = update_fuel_level(fuel_pct, category, speed_kmh, IOT_INTERVAL_SECONDS)

        engine_temp = simulate_engine_temp(engine_temp, speed_kmh, is_engine_on=True)
        battery_v = simulate_battery_voltage(is_engine_on=True)

        lat, lon = route_coords[step]

        if speed_kmh < 3.0:
            event_type = "IDLE"
        else:
            event_type = "DRIVING"

        rows.append(
            dict(
                DEVICE_ID=device_id,
                CAR_ID=car_id,
                RENTAL_ID=trip_id,
                TIMESTAMP=ts,
                LATITUDE=lat,
                LONGITUDE=lon,
                SPEED_KMH=speed_kmh,
                ACCELERATION_MS2=acc_ms2,
                BRAKE_PRESSURE_BAR=brake_pressure,
                FUEL_LEVEL_PCT=fuel_pct,
                BATTERY_VOLTAGE=battery_v,
                ENGINE_TEMP_C=engine_temp,
                ODOMETER_KM=odometer_km,
                EVENT_TYPE=event_type,
                BRANCH_NAME=branch_name,
                CITY=city,
            )
        )

    # ENGINE_STOP
    last = rows[-1].copy()
    last["TIMESTAMP"] += timedelta(seconds=IOT_INTERVAL_SECONDS)
    last["EVENT_TYPE"] = "ENGINE_STOP"
    last["SPEED_KMH"] = 0.0
    last["ACCELERATION_MS2"] = 0.0
    last["BRAKE_PRESSURE_BAR"] = 0.0
    last["BATTERY_VOLTAGE"] = simulate_battery_voltage(is_engine_on=False)
    rows.append(last)

    # REFUEL éventuel
    if fuel_pct < 15.0:
        ref_ts = rows[-1]["TIMESTAMP"] + timedelta(minutes=5)
        ref_row = rows[-1].copy()
        ref_row["TIMESTAMP"] = ref_ts
        ref_row["EVENT_TYPE"] = "REFUEL"
        ref_row["SPEED_KMH"] = 0.0
        ref_row["ACCELERATION_MS2"] = 0.0
        ref_row["BRAKE_PRESSURE_BAR"] = 0.0
        ref_row["FUEL_LEVEL_PCT"] = 100.0
        ref_row["BATTERY_VOLTAGE"] = simulate_battery_voltage(is_engine_on=False)
        rows.append(ref_row)
        fuel_pct = 100.0

    final_odometer = rows[-1]["ODOMETER_KM"]
    final_fuel = rows[-1]["FUEL_LEVEL_PCT"]
    return rows, final_odometer, final_fuel

# ============================================================
# RENTAL-LEVEL SIMULATION
# ============================================================

def simulate_car_for_period(car_row, start_dt, days_forward):
    all_rows = []
    car_id = int(car_row["CAR_ID"])
    print(f"🚗 Simulating car {car_id} ({car_row['LICENSE_PLATE']})")

    # Certaines voitures ne seront jamais louées ce mois-ci
    if random.random() < PROB_CAR_NEVER_RENTED:
        print(f"   ➜ Car {car_id} has no rentals this period (parking/maintenance).")
        return all_rows

    odometer_km = float(car_row["ODOMETER_KM"])
    fuel_pct = 100.0

    rental_counter = 1
    day_index = 0

    while day_index < days_forward:
        # Gap de jours sans location
        if random.random() < 0.3:
            gap_days = random.randint(1, 2)
            day_index += gap_days
            if day_index >= days_forward:
                break

        remaining_days = days_forward - day_index
        rental_days = sample_rental_duration(remaining_days)
        rental_id = rental_counter
        rental_counter += 1

        for offset in range(rental_days):
            if day_index + offset >= days_forward:
                break

            # Day derived from the datetime anchor
            day = (start_dt + timedelta(days=day_index + offset)).date()

            r = random.random()
            if r < P_NO_TRIP:
                trips_today = 0
            elif r < P_NO_TRIP + P_ONE_TRIP:
                trips_today = 1
            else:
                trips_today = 2

            if trips_today == 0:
                continue

            windows = build_allowed_windows_for_day()

            for _ in range(trips_today):
                start_minute = sample_start_minute_from_windows(windows)

                latest_start = DAY_END_HOUR * 60 - 30
                start_minute = min(start_minute, latest_start)

                trip_start_dt = datetime.combine(day, datetime.min.time()) + timedelta(minutes=start_minute)

                # ✅ Force first day to not start before now+5min
                if day == start_dt.date() and trip_start_dt < start_dt:
                    trip_start_dt = start_dt

                trip_duration_min = random.randint(TRIP_DURATION_MIN_MIN, TRIP_DURATION_MIN_MAX)

                rows, odometer_km, fuel_pct = generate_trip_points(
                    car_row,
                    trip_id=rental_id,
                    trip_start_dt=trip_start_dt,
                    trip_duration_min=trip_duration_min,
                    base_odometer_km=odometer_km,
                    initial_fuel_pct=fuel_pct,
                )
                all_rows.extend(rows)

        day_index += rental_days

    return all_rows

# ============================================================
# WRITE TO ORACLE
# ============================================================
def write_telemetry_to_oracle(all_rows):
    df = pd.DataFrame(all_rows)
    if df.empty:
        print("⚠️ write_telemetry_to_oracle: dataframe vide, rien à insérer.")
        return

    df.sort_values(["TIMESTAMP", "CAR_ID", "DEVICE_ID"], inplace=True)
    df["CREATED_AT"] = df["TIMESTAMP"]

    print(f"📝 Préparation insert Oracle : {len(df):,} lignes")

    # On garde uniquement les colonnes qui existent dans IOT_TELEMETRY
    df_db = df[[
        "DEVICE_ID",
        "CAR_ID",
        "RENTAL_ID",
        "TIMESTAMP",          # sera renommé en EVENT_TS
        "LATITUDE",
        "LONGITUDE",
        "SPEED_KMH",
        "ACCELERATION_MS2",
        "BRAKE_PRESSURE_BAR",
        "FUEL_LEVEL_PCT",
        "BATTERY_VOLTAGE",
        "ENGINE_TEMP_C",
        "ODOMETER_KM",
        "EVENT_TYPE",
        "CREATED_AT",
    ]].copy()

    df_db.rename(columns={"TIMESTAMP": "EVENT_TS"}, inplace=True)

    with engine.begin() as conn:
        # 💣 TRUNCATE AVANT INSERT — comme tu le voulais
        conn.execute(text("TRUNCATE TABLE IOT_TELEMETRY"))
        print("🧹 TRUNCATE IOT_TELEMETRY")

        # ⚠️ IMPORTANT : PAS de method="multi" avec Oracle
        df_db.to_sql(
            "IOT_TELEMETRY",
            conn,
            if_exists="append",
            index=False,
            chunksize=5000,   # on garde le chunking mais sans 'multi'
        )

    print("✅ Insert Oracle terminé.")

# ============================================================
# MAIN GENERATION LOGIC
# ============================================================

def generate_iot_telemetry_db():
    setup_random_seed()
    start_dt = get_start_datetime_now_plus_5min()
    days_forward = DAYS_FORWARD

    print(f"📅 Generating telemetry starting at {start_dt} for {days_forward} days (~1 month).")

    cars_df = fetch_cars_with_devices()
    if cars_df.empty:
        print("⚠️ Aucun véhicule IoT trouvé en base.")
        return

    all_rows = []

    for _, car_row in cars_df.iterrows():
        rows = simulate_car_for_period(car_row, start_dt, days_forward)
        all_rows.extend(rows)

    if not all_rows:
        print("⚠️ Aucun point de télémétrie généré.")
        return

    print(f"📈 Generated {len(all_rows):,} telemetry points. Insertion en base...")
    write_telemetry_to_oracle(all_rows)
    print("🎉 IoT telemetry generation + DB insert completed.")

# ============================================================
# ENTRYPOINT
# ============================================================

if __name__ == "__main__":
    generate_iot_telemetry_db()
