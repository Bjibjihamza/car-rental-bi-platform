# 03_generate_iot_telemetry.py
# ============================================================
# Generate synthetic IoT telemetry for next 7 days based on
# the Oracle car-rental schema. Uses OpenStreetMap (osmnx)
# to follow *real* roads per city (no more cars in the ocean 😄)
# ============================================================

import os
import math
import random
from datetime import datetime, timedelta, date

import pandas as pd
from sqlalchemy import create_engine, text

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
DAYS_FORWARD = 7                # horizon de génération (7 prochains jours)
OUTPUT_DIR = "data"             # dossier de sortie des CSV

# Fenêtre de conduite (pas de conduite la nuit)
DAY_START_HOUR = 7   # 07h00
DAY_END_HOUR = 21    # 21h00

# Probabilités de trajets par jour et par voiture
P_NO_TRIP = 0.4      # 40% des jours sans trajet
P_ONE_TRIP = 0.45    # 45% des jours avec 1 trajet
P_TWO_TRIPS = 0.15   # 15% des jours avec 2 trajets

# Durée d'un trajet (en minutes)
TRIP_DURATION_MIN_MIN = 15
TRIP_DURATION_MIN_MAX = 90

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
# UTILS
# ============================================================

def setup_random_seed():
    random.seed(RANDOM_SEED)


def get_start_date():
    """Date de départ = aujourd'hui (sans timezone pour simplicité)."""
    return date.today()


def deg_per_km_lat():
    # ~111 km par degré de latitude
    return 1.0 / 111.0


def deg_per_km_lon(lat_deg):
    # ~111 km * cos(lat) par degré de longitude
    return 1.0 / (111.0 * max(math.cos(math.radians(lat_deg)), 0.1))


def pick_trip_type():
    # simple : ville, mixte, autoroute
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
    # Décélération forte -> freinage fort
    if acc_ms2 < -2.5:
        return random.uniform(40, 80)
    elif acc_ms2 < -1.0:
        return random.uniform(10, 40)
    else:
        return random.uniform(0, 5)


def update_fuel_level(fuel_pct, category_name, speed_kmh, dt_seconds):
    if CATEGORY_FUEL_CONS.get(category_name.upper(), 0.0) == 0:
        # Pour les électriques on laisse stable pour l'instant
        return fuel_pct

    # distance parcourue (km)
    dist_km = speed_kmh * dt_seconds / 3600.0
    cons_l_per_100 = CATEGORY_FUEL_CONS[category_name.upper()]
    tank_size = CATEGORY_TANK_SIZE[category_name.upper()]
    if tank_size <= 0:
        return fuel_pct

    # litres consommés
    cons_l = cons_l_per_100 * dist_km / 100.0
    # % consommé
    cons_pct = (cons_l / tank_size) * 100.0
    fuel_pct = max(0.0, fuel_pct - cons_pct)
    return fuel_pct


def simulate_engine_temp(prev_temp, speed_kmh, is_engine_on):
    if not is_engine_on:
        # moteur éteint → refroidissement
        if prev_temp is None:
            return 25.0
        return max(25.0, prev_temp - random.uniform(0.1, 0.3))

    # moteur actif
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


# ============================================================
# OSM / ROUTING HELPERS
# ============================================================

_CITY_GRAPHS = {}

def get_city_graph(city):
    """
    Charge (et met en cache) le graphe routier OSM de la ville.
    """
    city_u = (city or "").title() + ", Morocco"
    if city_u in _CITY_GRAPHS:
        return _CITY_GRAPHS[city_u]

    print(f"🗺️  Loading road graph for {city_u} from OpenStreetMap...")
    # In modern osmnx versions, edges already have 'length' attribute.
    G = ox.graph_from_place(city_u, network_type="drive")

    _CITY_GRAPHS[city_u] = G
    return G


def build_road_route_for_trip(city, steps, lat0, lon0):
    """
    Construit un trajet aller-retour sur les routes :
      - départ ~ centre-ville (lat0/lon0)
      - destination = noeud aléatoire
      - trajet = chemin le plus court aller + retour (boucle)
    Renvoie une liste de len = steps+1 de (lat, lon) déjà échantillonnée
    pour nos pas de 30s.
    """
    G = get_city_graph(city)

    # noeud d'origine : le plus proche du centre-ville
    orig = ox.distance.nearest_nodes(G, lon0, lat0)

    nodes = list(G.nodes)
    dest = orig
    tries = 0
    # choisir une destination différente de l'origine
    while dest == orig and tries < 50:
        dest = random.choice(nodes)
        tries += 1

    # chemin aller + retour sur les routes
    try:
        path_out = ox.shortest_path(G, orig, dest, weight="length")
    except Exception:
        # fallback : si échec, rester autour de l'origine
        path_out = [orig]

    path_back = list(reversed(path_out))
    full_path = path_out + path_back[1:]  # éviter de dupliquer le point central

    # récupérer les coordonnées de chaque noeud du chemin
    coords_path = [(G.nodes[n]["y"], G.nodes[n]["x"]) for n in full_path]

    # on veut exactement steps+1 points (0..steps) → rééchantillonnage linéaire
    if len(coords_path) == 1:
        # chemin trivial : rester au centre
        return [(lat0, lon0)] * (steps + 1)

    coords_resampled = []
    for i in range(steps + 1):
        # position fractionnaire dans le chemin [0, len-1]
        idx_float = i * (len(coords_path) - 1) / steps
        idx0 = int(idx_float)
        idx1 = min(idx0 + 1, len(coords_path) - 1)
        alpha = idx_float - idx0

        lat0_seg, lon0_seg = coords_path[idx0]
        lat1_seg, lon1_seg = coords_path[idx1]

        lat = lat0_seg + alpha * (lat1_seg - lat0_seg)
        lon = lon0_seg + alpha * (lon1_seg - lon0_seg)
        coords_resampled.append((lat, lon))

    # on force explicitement start/stop = centre agence
    coords_resampled[0] = (lat0, lon0)
    coords_resampled[-1] = (lat0, lon0)

    return coords_resampled


# ============================================================
# FETCH CARS & DEVICES FROM DB
# ============================================================

def fetch_cars_with_devices():
    """
    Récupère les voitures avec leur catégorie, agence et device IoT.
    On ne garde que les voitures qui ont un DEVICE_ID non nul.
    La fonction est robuste aux variations de nom de colonne (Oracle/pandas).
    """
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

    # Garder une copie des noms d'origine pour debug
    orig_cols = list(df.columns)
    # Normaliser (Oracle aime bien faire des trucs chelous)
    df.columns = [c.upper().strip() for c in df.columns]

    # --- Normalisation de DEVICE_ID ---
    dev_col = None
    # 1) exact match
    for c in df.columns:
        if c == "DEVICE_ID":
            dev_col = c
            break
    # 2) sinon, n'importe quelle colonne qui contient DEVICE_ID
    if dev_col is None:
        for c in df.columns:
            if "DEVICE_ID" in c:
                dev_col = c
                break

    if dev_col is None:
        print(f"⚠️ fetch_cars_with_devices: aucune colonne DEVICE_ID trouvée. Colonnes = {orig_cols}")
        # on crée une colonne vide, donc pas de voiture IoT
        df["DEVICE_ID"] = None
    elif dev_col != "DEVICE_ID":
        df.rename(columns={dev_col: "DEVICE_ID"}, inplace=True)

    # Normaliser aussi quelques autres colonnes importantes (au cas où)
    rename_map = {}
    for target in ["CAR_ID", "ODOMETER_KM", "BRANCH_NAME", "CITY", "CATEGORY_NAME"]:
        if target not in df.columns:
            # chercher un candidat par inclusion
            for c in df.columns:
                if target in c:
                    rename_map[c] = target
                    break
    if rename_map:
        df.rename(columns=rename_map, inplace=True)

    # Valeurs par défaut
    df["CITY"] = df.get("CITY", "CASABLANCA").fillna("CASABLANCA")
    df["CATEGORY_NAME"] = df.get("CATEGORY_NAME", "ECONOMY").fillna("ECONOMY")
    df["ODOMETER_KM"] = df.get("ODOMETER_KM", 0).fillna(0).astype(float)

    # On ne garde que les voitures avec un device
    df = df[df["DEVICE_ID"].notna()].copy()

    print(f"📦 Loaded {len(df)} cars with IoT devices. (Colonnes réelles: {list(df.columns)})")
    return df


# ============================================================
# TRIP SIMULATION
# ============================================================

def generate_trip_points(
    car_row,
    trip_id,
    trip_start_dt,
    trip_duration_min,
    base_odometer_km,
    initial_fuel_pct,
):
    """
    Génère les points de télémétrie pour un trajet :
    - ENGINE_START
    - DRIVING / IDLE (avec vitesses, lat/long, odomètre, accel, freinage, fuel, temp, batterie)
    - REFUEL éventuel
    - ENGINE_STOP
    """

    category = car_row["CATEGORY_NAME"]
    car_id = int(car_row["CAR_ID"])
    device_id = int(car_row["DEVICE_ID"])
    branch_name = car_row["BRANCH_NAME"]
    city = car_row["CITY"]

    lat0, lon0 = get_city_center(city)
    trip_type = pick_trip_type()

    total_seconds = trip_duration_min * 60
    steps = max(1, total_seconds // IOT_INTERVAL_SECONDS)

    # 🗺️ Route réelle sur les routes OSM, aller + retour
    route_coords = build_road_route_for_trip(city, steps, lat0, lon0)

    # états init
    rows = []
    ts = trip_start_dt
    speed_kmh = 0.0
    prev_speed_kmh = None
    odometer_km = base_odometer_km
    fuel_pct = initial_fuel_pct
    engine_temp = None
    battery_v = simulate_battery_voltage(is_engine_on=False)
    event_type = "ENGINE_START"

    # Premier point: ENGINE_START au centre agence
    lat, lon = route_coords[0]
    engine_temp = simulate_engine_temp(engine_temp, speed_kmh, is_engine_on=True)
    acc_ms2 = 0.0
    brake_pressure = 0.0

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

    # Points suivants: DRIVING / IDLE sur le trajet routier
    engine_on = True
    for step in range(1, steps):
        ts += timedelta(seconds=IOT_INTERVAL_SECONDS)

        # vitesse cible selon type de route, avec variations
        base_speed = sample_speed(category, trip_type)
        rel = step / steps
        if rel < 0.1:
            target_speed = base_speed * (rel / 0.1)     # accélération
        elif rel > 0.9:
            target_speed = base_speed * max(0, (1.0 - rel) / 0.1)  # décélération
        else:
            target_speed = base_speed

        speed_kmh = max(0.0, target_speed + random.gauss(0, base_speed * 0.05))

        # DRIVING vs IDLE
        if speed_kmh < 3.0:
            event_type = "IDLE"
        else:
            event_type = "DRIVING"

        # Accélération
        acc_ms2 = compute_acceleration(prev_speed_kmh, speed_kmh, IOT_INTERVAL_SECONDS)

        # Freinage
        brake_pressure = compute_brake_pressure(acc_ms2)

        # Distance & odomètre (basé sur la vitesse, pas sur la longueur exacte de la route)
        dist_km = speed_kmh * IOT_INTERVAL_SECONDS / 3600.0
        odometer_km += dist_km

        # Fuel
        fuel_pct = update_fuel_level(fuel_pct, category, speed_kmh, IOT_INTERVAL_SECONDS)

        # Température moteur & batterie
        engine_temp = simulate_engine_temp(engine_temp, speed_kmh, is_engine_on=engine_on)
        battery_v = simulate_battery_voltage(is_engine_on=engine_on)

        # Position GPS = point correspondant sur la route
        lat, lon = route_coords[step]

        prev_speed_kmh = speed_kmh

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

    # Dernier point = ENGINE_STOP au même endroit qu'au départ (agence)
    last = rows[-1].copy()
    last["TIMESTAMP"] += timedelta(seconds=IOT_INTERVAL_SECONDS)
    last["EVENT_TYPE"] = "ENGINE_STOP"
    last["SPEED_KMH"] = 0.0
    last["ACCELERATION_MS2"] = 0.0
    last["BRAKE_PRESSURE_BAR"] = 0.0
    last["BATTERY_VOLTAGE"] = simulate_battery_voltage(is_engine_on=False)
    last["LATITUDE"], last["LONGITUDE"] = route_coords[-1]  # centre-ville
    rows.append(last)

    # REFUEL éventuel: si fuel < 15% on simule un ravitaillement
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
# MAIN GENERATION LOGIC
# ============================================================

def simulate_car_for_period(car_row, start_date, days_forward):
    """
    Génère des trajets pour une voiture sur N jours.
    Renvoie une liste de dict (télémétries).
    """
    all_rows = []
    car_id = int(car_row["CAR_ID"])
    print(f"🚗 Simulating car {car_id} ({car_row['LICENSE_PLATE']})")

    # état persistant de la voiture sur plusieurs jours
    odometer_km = float(car_row["ODOMETER_KM"])
    fuel_pct = 100.0  # on part full tank

    rental_counter = 1  # id synthétique pour RENTAL_ID

    for d in range(days_forward):
        day = start_date + timedelta(days=d)
        # combien de trajets pour ce jour ?
        r = random.random()
        if r < P_NO_TRIP:
            # aucun trajet ce jour-là
            continue
        elif r < P_NO_TRIP + P_ONE_TRIP:
            trips_today = 1
        else:
            trips_today = 2

        # on choisit des heures de départ dans la fenêtre autorisée
        available_minutes = (DAY_END_HOUR - DAY_START_HOUR) * 60
        # on répartit grossièrement les trajets dans la journée
        slot_length = available_minutes // (trips_today + 1)

        for t in range(trips_today):
            # heure de départ approximative
            start_minute = DAY_START_HOUR * 60 + slot_length * (t + 1) + random.randint(-15, 15)
            start_minute = max(DAY_START_HOUR * 60, min(DAY_END_HOUR * 60 - 30, start_minute))

            trip_start_dt = datetime.combine(day, datetime.min.time()) + timedelta(minutes=start_minute)
            trip_duration_min = random.randint(TRIP_DURATION_MIN_MIN, TRIP_DURATION_MIN_MAX)

            rows, odometer_km, fuel_pct = generate_trip_points(
                car_row,
                trip_id=rental_counter,
                trip_start_dt=trip_start_dt,
                trip_duration_min=trip_duration_min,
                base_odometer_km=odometer_km,
                initial_fuel_pct=fuel_pct,
            )
            all_rows.extend(rows)
            rental_counter += 1

    return all_rows


def generate_iot_telemetry_csv():
    setup_random_seed()
    start_date = get_start_date()

    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR, exist_ok=True)

    cars_df = fetch_cars_with_devices()
    if cars_df.empty:
        print("⚠️ Aucun véhicule IoT trouvé en base.")
        return

    all_rows = []

    for _, car_row in cars_df.iterrows():
        rows = simulate_car_for_period(car_row, start_date, DAYS_FORWARD)
        all_rows.extend(rows)

    if not all_rows:
        print("⚠️ Aucun point de télémétrie généré.")
        return

    df = pd.DataFrame(all_rows)

    # Trier par timestamp
    df.sort_values(["TIMESTAMP", "CAR_ID", "DEVICE_ID"], inplace=True)

    # On ajoute CREATED_AT identique au timestamp pour le CSV (optionnel)
    df["CREATED_AT"] = df["TIMESTAMP"]

    print(f"📈 Generated {len(df)} telemetry points for {DAYS_FORWARD} days.")

    # Exporter 1 CSV par jour
    df["DATE"] = df["TIMESTAMP"].dt.date
    for day, sub in df.groupby("DATE"):
        fname = os.path.join(OUTPUT_DIR, f"iot_telemetry_{day.strftime('%Y%m%d')}.csv")
        sub.drop(columns=["DATE"], inplace=False).to_csv(fname, index=False)
        print(f"💾 Wrote {len(sub)} rows to {fname}")

    print("✅ IoT telemetry CSV generation completed.")


# ============================================================
# ENTRYPOINT
# ============================================================

if __name__ == "__main__":
    generate_iot_telemetry_csv()
