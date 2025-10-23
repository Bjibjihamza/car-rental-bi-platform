# demo_iot.py
# ==========================================================================
# IoT Streaming Daemon – append CSV in real time
# - NE STREAM QUE LES RENTALS EN STATUS = 'ACTIVE'
# - s'arrête quand STATUS devient 'CLOSED'
# - évite les respawns en mémorisant les rentals déjà lancés
# - robustesse colonnes (df_norm) pour éviter KeyError 'STATUS'
# ==========================================================================

import time
import threading
import random
from datetime import datetime, timedelta
import csv
from pathlib import Path
import pandas as pd
from sqlalchemy import create_engine, text

# -----------------------
# DB
# -----------------------
engine = create_engine(
    "oracle+oracledb://",
    connect_args={"user": "raw_layer", "password": "Raw#123", "dsn": "localhost:1521/XEPDB1"},
    pool_pre_ping=True,
)

# -----------------------
# Streaming config
# -----------------------
ACCELERATION_FACTOR = 3600  # 3600x => 1 sec réel = 1 heure simulée
POLL_SEC = 1.0              # fréquence de poll DB (réel)
STEP_SIM_MIN = 1            # pas de temps simulé entre 2 lectures
OUTPUT = Path("iot_stream.csv")

random.seed(42)

def log(msg: str):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)

def df_norm(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [c.upper().strip() for c in df.columns]
    return df

def write_csv_header_if_needed():
    exists = OUTPUT.exists()
    if not exists:
        with OUTPUT.open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow([
                "telemetry_id","device_id","car_id","rental_id","reading_at_iso",
                "latitude","longitude","speed_kmh","fuel_level_pct","battery_voltage",
                "engine_temp_c","odometer_km","event_type"
            ])

# petit générateur de positions “autour” d’une base
def jitter(base, spread=0.5):
    return base + random.uniform(-spread, spread)

def engine_temp(speed):
    # au ralenti ~20-40°C (atelier), en roulage ~85-105°C
    return round(random.uniform(20, 40) if speed <= 0.1 else random.uniform(85, 105), 2)

def event_and_speed(step_idx, steps):
    if step_idx == 0:
        return "ENGINE_START", 0.0
    if step_idx == steps - 1:
        return "ENGINE_STOP", 0.0
    # mix d'événements
    ev = random.choices(["DRIVING","IDLE","HARSH_BRAKE","RAPID_ACCEL"], weights=[75,15,5,5])[0]
    spd = 0.0 if ev == "IDLE" else random.uniform(30, 120)
    return ev, round(spd, 2)

# -----------------------
# Thread IoT pour 1 rental actif
# -----------------------
def iot_thread(rental_id: int, car_id: int, device_id: int,
               start_at: datetime, due_at: datetime,
               start_odo: int, branch_lat: float, branch_lon: float):

    log(f"🛰 IoT started for rental #{rental_id} (device {device_id})")
    steps = max(3, int(((due_at - start_at).total_seconds() / 60.0) / STEP_SIM_MIN))
    sim_dt = timedelta(minutes=STEP_SIM_MIN)

    telemetry_id = 1   # on remet à 1 par rental pour lisible (si tu veux global, mets un compteur global/thread-safe)
    sim_time = start_at

    # boucle principale: génère, écrit, et vérifie le statut en DB pour stop
    for idx in range(steps):
        # si la location est fermée, on arrête
        with engine.begin() as conn:
            t = pd.read_sql(
                text("SELECT STATUS, NVL(END_ODOMETER,0) AS END_ODOMETER FROM RENTALS WHERE RENTAL_ID=:rid"),
                conn, params={"rid": rental_id}
            )
        if not t.empty:
            row = df_norm(t).iloc[0]
            status = str(row.get("STATUS", "")).upper()
            if status == "CLOSED":
                log(f"🛰 IoT finished for rental #{rental_id}")
                return
        else:
            # rental disparu ? on s'arrête
            log(f"⚠ rental {rental_id} not found anymore; stopping IoT")
            return

        # event + vitesse
        ev, speed = event_and_speed(idx, steps)

        # odomètre progression linéaire simple
        progress = idx / max(1, steps - 1)
        odo = start_odo + int(progress * random.uniform(1, 5) * STEP_SIM_MIN)  # ~1-5 km / 5 min (sim)

        # position/fuel/battery
        lat = round(jitter(branch_lat, 0.3), 7)
        lon = round(jitter(branch_lon, 0.3), 7)
        fuel = round(max(5.0, 100.0 - progress * random.uniform(30, 60)), 2)
        batt = round(random.uniform(12.0, 14.5), 2)
        temp = engine_temp(speed)

        # écriture CSV (append)
        with OUTPUT.open("a", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow([
                telemetry_id, device_id, car_id, rental_id, sim_time.isoformat(),
                lat, lon, speed, fuel, batt, temp, odo, ev
            ])

        telemetry_id += 1
        # avance temps simulé -> dors en “réel”
        sim_time += sim_dt
        time.sleep(max(0.1, (sim_dt.total_seconds()) / ACCELERATION_FACTOR))

    log(f"🛰 IoT finished for rental #{rental_id}")

# -----------------------
# Boucle de surveillance
# -----------------------
def main():
    log("=" * 74)
    log("IoT Streaming Daemon – watching DB and appending to CSV in real time")
    log(f"ACCELERATION_FACTOR={ACCELERATION_FACTOR}x, interval={STEP_SIM_MIN} simulated minutes")
    log("=" * 74)
    write_csv_header_if_needed()

    spawned: set[int] = set()  # rentals déjà lancés en IoT

    try:
        while True:
            # détecter les rentals ACTIFS avec un device
            with engine.begin() as conn:
                q = """
                    SELECT r.RENTAL_ID, r.CAR_ID, r.STATUS, r.START_AT, r.DUE_AT,
                           NVL(r.START_ODOMETER,0) AS START_ODOMETER,
                           c.DEVICE_ID,
                           b.CITY, b.BRANCH_NAME,
                           CASE b.CITY
                             WHEN 'Casablanca' THEN 33.5731
                             WHEN 'Rabat'      THEN 34.0209
                             WHEN 'Marrakech'  THEN 31.6295
                             WHEN 'Tanger'     THEN 35.7595
                             WHEN 'Agadir'     THEN 30.4278
                             ELSE 33.5731
                           END AS LAT,
                           CASE b.CITY
                             WHEN 'Casablanca' THEN -7.5898
                             WHEN 'Rabat'      THEN -6.8416
                             WHEN 'Marrakech'  THEN -7.9811
                             WHEN 'Tanger'     THEN -5.8340
                             WHEN 'Agadir'     THEN -9.5981
                             ELSE -7.5898
                           END AS LON
                    FROM RENTALS r
                    JOIN CARS c       ON c.CAR_ID = r.CAR_ID
                    LEFT JOIN BRANCHES b ON b.BRANCH_ID = r.BRANCH_ID
                    WHERE r.STATUS = 'ACTIVE'
                      AND c.DEVICE_ID IS NOT NULL
                """
                t = pd.read_sql(text(q), conn)

            if not t.empty:
                t = df_norm(t)
                for _, row in t.iterrows():
                    rental_id   = int(row["RENTAL_ID"])
                    if rental_id in spawned:
                        continue  # déjà en cours

                    # garde-fous colonnes
                    car_id      = int(row["CAR_ID"])
                    status      = str(row.get("STATUS","")).upper()
                    if status != "ACTIVE":
                        continue

                    device_id   = int(row["DEVICE_ID"])
                    start_at    = row["START_AT"] if isinstance(row["START_AT"], datetime) else pd.to_datetime(row["START_AT"]).to_pydatetime()
                    due_at      = row["DUE_AT"]   if isinstance(row["DUE_AT"],   datetime) else pd.to_datetime(row["DUE_AT"]).to_pydatetime()
                    start_odo   = int(row.get("START_ODOMETER", 0))
                    lat         = float(row.get("LAT", 33.5731))
                    lon         = float(row.get("LON", -7.5898))

                    log(f"🆕 IoT thread spawned for rental #{rental_id} (car {car_id}, device {device_id})")
                    th = threading.Thread(
                        target=iot_thread,
                        args=(rental_id, car_id, device_id, start_at, due_at, start_odo, lat, lon),
                        daemon=True,
                    )
                    th.start()
                    spawned.add(rental_id)
            else:
                # rien d'actif pour l'instant
                pass

            time.sleep(POLL_SEC)
    except KeyboardInterrupt:
        log("⏹️  Daemon interrupted by user.")
    finally:
        log("🏁 Daemon exited.")
        
if __name__ == "__main__":
    main()
