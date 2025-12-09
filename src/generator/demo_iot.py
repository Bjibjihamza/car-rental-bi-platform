# demo_iot_batch.py - BATCH IoT GENERATION TO DATABASE
# -------------------------------------------------------------------
# Génère TOUTES les données IoT et les insère dans IOT_TELEMETRY
# -------------------------------------------------------------------

import random
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text


# =========================
# Configuration
# =========================
random.seed(42)
np.random.seed(42)


# Database
engine = create_engine(
    "oracle+oracledb://",
    connect_args={"user": "raw_layer", "password": "Raw#123", "dsn": "localhost:1521/XEPDB1"},
    pool_pre_ping=True,
)

# IoT Settings
IOT_INTERVAL_SECONDS = 30  # Intervalle entre les mesures IoT
BATCH_SIZE = 500  # Nombre de records à insérer par batch

# Speed profiles par catégorie
CATEGORY_SPEED_PROFILES = {
    "ECONOMY":  {"city": (20, 60),  "highway": (60, 110), "max": 120},
    "SUV":      {"city": (25, 65),  "highway": (70, 120), "max": 130},
    "LUXURY":   {"city": (30, 70),  "highway": (80, 150), "max": 180},
    "VAN":      {"city": (20, 55),  "highway": (60, 100), "max": 110},
    "ELECTRIC": {"city": (25, 65),  "highway": (70, 130), "max": 140},
}


DRIVING_CONTEXTS = {
    "city_traffic": {"weight": 30, "speed_mult": 0.4, "stop_prob": 0.30},
    "city_normal":  {"weight": 25, "speed_mult": 0.7, "stop_prob": 0.15},
    "suburban":     {"weight": 20, "speed_mult": 0.85, "stop_prob": 0.08},
    "highway":      {"weight": 20, "speed_mult": 1.0, "stop_prob": 0.02},
    "mountain":     {"weight": 5,  "speed_mult": 0.6, "stop_prob": 0.05},
}

CITY_COORDS = {
    "CASABLANCA": (33.5731, -7.5898),
    "RABAT":      (34.0209, -6.8416),
    "MARRAKECH":  (31.6295, -7.9811),
    "TANGER":     (35.7595, -5.8340),
    "AGADIR":     (30.4278, -9.5981),
}

# =========================
# Utils
# =========================
def log(msg: str):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)

def df_norm(df):
    df.columns = [c.upper().strip() for c in df.columns]
    return df

def get_city_coords(city_name):
    for city, coords in CITY_COORDS.items():
        if city.lower() in city_name.lower():
            return coords
    return (33.0, -7.0)


# =========================
# GPS & Driving Simulation
# =========================
class GPSRoute:
    def __init__(self, start_lat, start_lon, end_lat, end_lon):
        self.start_lat = start_lat
        self.start_lon = start_lon
        self.end_lat = end_lat
        self.end_lon = end_lon
        self.current_lat = start_lat
        self.current_lon = start_lon

    def next_position(self, percent):
        # Linear interpolation for round-trip
        self.current_lat = self.start_lat + percent * (self.end_lat - self.start_lat)
        self.current_lon = self.start_lon + percent * (self.end_lon - self.start_lon)
        return round(self.current_lat, 7), round(self.current_lon, 7)


class DrivingSimulator:
    def __init__(self, category_name, start_lat, start_lon, end_lat, end_lon):
        self.category_name = category_name.upper()
        self.speed_profile = CATEGORY_SPEED_PROFILES.get(
            self.category_name, CATEGORY_SPEED_PROFILES["ECONOMY"]
        )
        self.current_speed = 0.0
        self.route = GPSRoute(start_lat, start_lon, end_lat, end_lon)

    def next_state(self, percent, timestamp):
        # Off-peak pause logic
        hour = timestamp.hour
        if 0 <= hour < 7 or 14 <= hour < 16 or 20 <= hour < 22:
            self.current_speed = 0.0
            event_type = "IDLE"
        else:
            if percent < 0.1 or percent > 0.9:
                self.current_speed = random.uniform(5, 20)
            else:
                context = "highway" if random.random() < 0.2 else "city_normal"
                target_speed = random.uniform(*self.speed_profile[context if context != "city_normal" else "city"])
                self.current_speed = target_speed + np.random.normal(0, 3)
            event_type = "DRIVING"
        lat, lon = self.route.next_position(percent)
        return self.current_speed, event_type, lat, lon


# =========================
# Sensors
# =========================
def generate_sensor_data(speed, odometer_delta, last_fuel, event_type, refuel_distance):
    base_rate = 0.18
    speed_factor = 1 + ((speed / 100) ** 2)
    fuel_burn = odometer_delta * base_rate * speed_factor
    fuel_level = last_fuel - fuel_burn
    if refuel_distance > random.uniform(50, 100):
        fuel_level = min(100.0, fuel_level + random.uniform(25, 35))
        event_type = "REFUEL"
        refuel_distance = 0
    engine_temp = random.uniform(40, 60) if speed == 0 else random.uniform(90, 105)
    if event_type in ["HARSH_BRAKE", "RAPID_ACCEL"]:
        engine_temp += random.uniform(5, 15)
    battery = random.uniform(12.2, 12.6) if speed == 0 else random.uniform(13.5, 14.5)
    return round(max(fuel_level, 5), 2), round(battery, 2), round(min(engine_temp, 120), 2), event_type, refuel_distance

def compute_acceleration_ms2(prev_speed_kmh: float, curr_speed_kmh: float, dt_seconds: float) -> float:
    if dt_seconds <= 0:
        return 0.0
    dv_ms = (curr_speed_kmh - prev_speed_kmh) / 3.6
    return round(dv_ms / dt_seconds, 3)

def estimate_brake_pressure_bar(acc_ms2: float, speed_kmh: float, event_type: str) -> float:
    if speed_kmh <= 0.1 and abs(acc_ms2) < 0.02:
        return 0.0
    decel = max(0.0, -acc_ms2)
    base = 12.0 * decel + 0.05 * max(0.0, speed_kmh)
    bonus = 0.0
    if event_type == "HARSH_BRAKE":
        bonus = 10.0
    elif event_type == "IDLE":
        bonus = -base
    noise = np.random.normal(0, 1.0)
    pressure = max(0.0, min(100.0, base + bonus + noise))
    return round(pressure, 2)

# =========================
# Database Operations
# =========================
def check_table_exists():
    query = """
        SELECT COUNT(*) AS CNT 
        FROM USER_TABLES 
        WHERE TABLE_NAME = 'IOT_TELEMETRY'
    """
    with engine.begin() as conn:
        result = pd.read_sql(text(query), conn)
        result = df_norm(result)
        return int(result.iloc[0]['CNT']) > 0

def truncate_iot_table():
    with engine.begin() as conn:
        try:
            conn.execute(text("TRUNCATE TABLE IOT_TELEMETRY"))
            log("🧹 Table IOT_TELEMETRY vidée")
        except Exception as e:
            log(f"⚠  Truncate failed, trying DELETE: {e}")
            deleted = conn.execute(text("DELETE FROM IOT_TELEMETRY")).rowcount
            log(f"🧽 Deleted {deleted} records from IOT_TELEMETRY")

def get_active_rentals():
    query = """
        SELECT 
            r.RENTAL_ID,
            r.CAR_ID,
            r.START_AT,
            r.DUE_AT,
            r.START_ODOMETER,
            c.DEVICE_ID,
            cat.CATEGORY_NAME,
            b.CITY
        FROM RENTALS r
        JOIN CARS c ON r.CAR_ID = c.CAR_ID
        JOIN CAR_CATEGORIES cat ON c.CATEGORY_ID = cat.CATEGORY_ID
        JOIN BRANCHES b ON r.BRANCH_ID = b.BRANCH_ID
        WHERE r.STATUS = 'ACTIVE'
          AND c.DEVICE_ID IS NOT NULL
        ORDER BY r.RENTAL_ID
    """
    with engine.begin() as conn:
        df = pd.read_sql(text(query), conn)
    if df.empty:
        return df
    df = df_norm(df)
    if "DEVICE_ID" in df.columns:
        df = df[df["DEVICE_ID"].notna()]
    return df

def insert_batch_to_db(records_batch):
    if not records_batch:
        return
    with engine.begin() as conn:
        raw_conn = conn.connection
        cursor = raw_conn.cursor()
        data = [
            (
                r['DEVICE_ID'], r['CAR_ID'], r['RENTAL_ID'], r['TIMESTAMP'],
                r['LATITUDE'], r['LONGITUDE'], r['SPEED_KMH'], r['ACCELERATION_MS2'],
                r['BRAKE_PRESSURE_BAR'], r['FUEL_LEVEL_PCT'], r['BATTERY_VOLTAGE'],
                r['ENGINE_TEMP_C'], r['ODOMETER_KM'], r['EVENT_TYPE'], r['CREATED_AT']
            )
            for r in records_batch
        ]
        sql = """
            INSERT INTO IOT_TELEMETRY (
                DEVICE_ID, CAR_ID, RENTAL_ID, TIMESTAMP,
                LATITUDE, LONGITUDE, SPEED_KMH, ACCELERATION_MS2,
                BRAKE_PRESSURE_BAR, FUEL_LEVEL_PCT, BATTERY_VOLTAGE,
                ENGINE_TEMP_C, ODOMETER_KM, EVENT_TYPE, CREATED_AT
            ) VALUES (
                :1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14, :15
            )
        """
        cursor.executemany(sql, data)
        cursor.close()

# =========================
# IoT Generation (Batch)
# =========================
def generate_iot_batch(rental_id, car_id, device_id, category_name,
                       start_time, end_time, start_odo, branch_lat, branch_lon):
    duration_seconds = max(0, (end_time - start_time).total_seconds())
    num_readings = max(2, int(duration_seconds / IOT_INTERVAL_SECONDS))
    end_lat, end_lon = branch_lat, branch_lon

    simulator = DrivingSimulator(category_name, branch_lat, branch_lon, end_lat, end_lon)
    records = []
    created_at = datetime.now()

    # ENGINE_START
    last_fuel = round(random.uniform(30, 50), 2)
    refuel_distance = 0
    prev_speed = 0.0
    prev_odo = int(start_odo)

    records.append({
        "DEVICE_ID": device_id,
        "CAR_ID": car_id,
        "RENTAL_ID": rental_id,
        "TIMESTAMP": start_time,
        "LATITUDE": branch_lat,
        "LONGITUDE": branch_lon,
        "SPEED_KMH": 0.0,
        "ACCELERATION_MS2": 0.0,
        "BRAKE_PRESSURE_BAR": 0.0,
        "FUEL_LEVEL_PCT": last_fuel,
        "BATTERY_VOLTAGE": 12.6,
        "ENGINE_TEMP_C": round(random.uniform(20, 35), 2),
        "ODOMETER_KM": int(start_odo),
        "EVENT_TYPE": "ENGINE_START",
        "CREATED_AT": created_at
    })

    # Driving telemetry
    for i in range(1, num_readings - 1):
        percent = i / (num_readings - 1)
        timestamp = start_time + timedelta(seconds=i * IOT_INTERVAL_SECONDS)
        curr_speed, event_type, lat, lon = simulator.next_state(percent, timestamp)
        odometer = prev_odo + (curr_speed * IOT_INTERVAL_SECONDS / 3600)
        odometer_delta = odometer - prev_odo
        refuel_distance += odometer_delta

        fuel, battery, temp, event_type, refuel_distance = generate_sensor_data(
            curr_speed, odometer_delta, last_fuel, event_type, refuel_distance
        )
        acceleration_ms2 = compute_acceleration_ms2(prev_speed, curr_speed, IOT_INTERVAL_SECONDS)
        brake_pressure_bar = estimate_brake_pressure_bar(acceleration_ms2, curr_speed, event_type)
        records.append({
            "DEVICE_ID": device_id,
            "CAR_ID": car_id,
            "RENTAL_ID": rental_id,
            "TIMESTAMP": timestamp,
            "LATITUDE": lat,
            "LONGITUDE": lon,
            "SPEED_KMH": round(curr_speed, 2),
            "ACCELERATION_MS2": acceleration_ms2,
            "BRAKE_PRESSURE_BAR": brake_pressure_bar,
            "FUEL_LEVEL_PCT": fuel,
            "BATTERY_VOLTAGE": battery,
            "ENGINE_TEMP_C": temp,
            "ODOMETER_KM": round(odometer, 2),
            "EVENT_TYPE": event_type,
            "CREATED_AT": created_at
        })
        prev_speed = curr_speed
        prev_odo = odometer
        last_fuel = fuel

    # ENGINE_STOP record - return to branch
    acceleration_ms2_stop = compute_acceleration_ms2(prev_speed, 0.0, IOT_INTERVAL_SECONDS)
    brake_pressure_bar_stop = max(0.0, round(estimate_brake_pressure_bar(acceleration_ms2_stop, 0.0, "IDLE"), 2))
    records.append({
        "DEVICE_ID": device_id,
        "CAR_ID": car_id,
        "RENTAL_ID": rental_id,
        "TIMESTAMP": end_time,
        "LATITUDE": branch_lat,
        "LONGITUDE": branch_lon,
        "SPEED_KMH": 0.0,
        "ACCELERATION_MS2": acceleration_ms2_stop,
        "BRAKE_PRESSURE_BAR": brake_pressure_bar_stop,
        "FUEL_LEVEL_PCT": last_fuel,
        "BATTERY_VOLTAGE": 12.4,
        "ENGINE_TEMP_C": round(random.uniform(60, 80), 2),
        "ODOMETER_KM": round(prev_odo,2),
        "EVENT_TYPE": "ENGINE_STOP",
        "CREATED_AT": created_at
    })

    return records


# =========================
# Main
# =========================

def main():
    print("\n" + "=" * 70)
    print("🚀 BATCH IoT GENERATION TO DATABASE")
    print("=" * 70)
    if not check_table_exists():
        log("❌ Table IOT_TELEMETRY n'existe pas!")
        log("   Exécutez d'abord: create_iot_telemetry_table.sql")
        return
    log("✅ Table IOT_TELEMETRY trouvée")
    truncate_iot_table()
    log("📊 Fetching ACTIVE rentals from database...")
    rentals = get_active_rentals()
    if rentals.empty:
        log("❌ No ACTIVE rentals found.")
        log("   Run: python demo_realtime.py (with EXECUTION_MODE='batch_activate')")
        return
    log(f"✅ Found {len(rentals)} active rental(s)\n")
    total_records = 0
    all_records = []
    for idx, rental in rentals.iterrows():
        try:
            rental_id = int(rental["RENTAL_ID"])
            car_id = int(rental["CAR_ID"])
            device_id = int(rental["DEVICE_ID"]) if pd.notna(rental["DEVICE_ID"]) else None
            if device_id is None:
                log(f"⚠  Skipping Rental #{rental_id} - No DEVICE_ID")
                continue
            category = str(rental["CATEGORY_NAME"])
            start_time = rental["START_AT"]
            end_time = rental["DUE_AT"]
            start_odo = int(rental["START_ODOMETER"])
            city = str(rental["CITY"])
            lat, lon = get_city_coords(city)
            duration_hours = (end_time - start_time).total_seconds() / 3600
            log(f"🚗 Rental #{rental_id} | {category} | {duration_hours:.1f}h | {city}")
            records = generate_iot_batch(
                rental_id, car_id, device_id, category,
                start_time, end_time, start_odo, lat, lon
            )
            all_records.extend(records)
            total_records += len(records)
            log(f"   ✅ Generated {len(records)} records | Total: {total_records}")
            if len(all_records) >= BATCH_SIZE:
                log(f"   💾 Inserting batch of {len(all_records)} records...")
                insert_batch_to_db(all_records)
                all_records = []
        except Exception as e:
            log(f"❌ Error processing Rental #{rental.get('RENTAL_ID', '?')}: {e}")
            continue
    if all_records:
        log(f"💾 Inserting final batch of {len(all_records)} records...")
        insert_batch_to_db(all_records)
    print("\n" + "=" * 70)
    pd.DataFrame(all_records).to_csv("demo_iot_validation.csv", index=False)
    log("🎉 COMPLETED!")
    print(f"📊 Total Rentals: {len(rentals)}")
    print(f"📊 Total IoT Records: {total_records}")
    print(f"💾 Inserted into: IOT_TELEMETRY table")
    print("=" * 70 + "\n")
    with engine.begin() as conn:
        count = pd.read_sql(text("SELECT COUNT(*) AS CNT FROM IOT_TELEMETRY"), conn)
        count = df_norm(count)
        log(f"✅ Verification: {int(count.iloc[0]['CNT'])} records in database")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("⏹ Interrupted by user")
    except Exception as e:  
        log(f"❌ Error: {e}")
        raise