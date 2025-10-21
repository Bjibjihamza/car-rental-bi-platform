# 🚗 Car Rental BI Platform — Oracle Setup Guide

This document explains how to set up the **Oracle backend** for the *Car Rental BI Platform*, which follows a **Medallion Data Architecture** (`Raw → Silver → Gold`) pattern on **Oracle XE 21c**.

---

## 📦 1. Run Oracle Database in Docker

Start by creating an Oracle XE 21c container with Docker Compose.

### 🧩 Compose File

Ensure the file `oracle-compose.yml` exists in your project root.

Run the following command:

```bash
docker compose -f oracle-compose.yml up -d
```

This will:

* Download and start the **Oracle XE 21c** container (`gvenzl/oracle-xe:21`)
* Expose ports `1521` (SQL*Net listener) and `5500` (Enterprise Manager Express)
* Automatically set up the system password and default users

---

## 🔍 2. Verify Database Readiness

Check logs to confirm Oracle is initialized:

**Linux/macOS:**

```bash
docker logs -f oracle-xe | grep -m1 "DATABASE IS READY TO USE!"
```

**Windows PowerShell:**

```powershell
docker logs -f oracle-xe | Select-String "DATABASE IS READY TO USE!" -SimpleMatch
```

Once you see that message, the container is ready for connections.

---

## 🧠 3. Connect to Oracle Database

You can connect inside the running container using SQL*Plus:

```bash
docker exec -it oracle-xe sqlplus system/Admin#123@localhost:1521/XEPDB1
```

> 🔹 **Details:**
>
> * `system/Admin#123` → username/password
> * `XEPDB1` → default Pluggable Database (PDB)

---

## 🛠️ 4. Create Medallion Schemas (Raw → Silver → Gold)

Run the setup script to create dedicated schemas for each data layer:

```bash
@src/database/scripts/oracle_medallion_setup.sql
```

This script:

* Creates users `RAW_LAYER`, `SILVER_LAYER`, and `GOLD_LAYER`
* Grants standard privileges
* Prepares each schema for ETL workflows and BI queries

If needed, grant trigger creation explicitly:

```sql
GRANT CREATE TRIGGER TO raw_layer;
GRANT CREATE TRIGGER TO silver_layer;
GRANT CREATE TRIGGER TO gold_layer;
```

---

## 📂 5. Load Schemas per Layer

After users are created, load their structure from the schema files.

### • Raw Layer

```bash
docker exec -it oracle-xe sqlplus raw_layer/Raw#123@localhost:1521/XEPDB1
```

```sql
@src/database/schema/raw.sql
```

### • Silver Layer

```bash
docker exec -it oracle-xe sqlplus silver_layer/Silver#123@localhost:1521/XEPDB1
```

```sql
@src/database/schema/silver.sql
```

### • Gold Layer

```bash
docker exec -it oracle-xe sqlplus gold_layer/Gold#123@localhost:1521/XEPDB1
```

```sql
@src/database/schema/gold.sql
```

---

## 💪 6. Seed Static Data (Branches, Managers, Cars, IoT Devices)

Once the **RAW** schema is ready, seed your static operational data.

Run from your Python environment:

```bash
python src/generator/seed_static.py
```

This script populates:

* Branches (`BRANCHES`)
* Managers (`MANAGERS`)
* IoT Devices (`IOT_DEVICES`)
* Cars (`CARS`)

These remain static across sessions.

---

## 🚀 7. Run Real-Time Simulation

After seeding static data, run the real-time simulation demo:

```bash
python src/generator/demo_realtime.py
```

This will:

* Simulate rentals in 5 branches across Morocco
* Create, activate, and close rentals dynamically
* Update car statuses in real time

Logs include timestamps for every simulated rental event.

---

## 🔧 8. Troubleshooting

### ORA-12514 / Connection Refused

> Check that your container is running and port 1521 is not blocked.

```bash
docker ps
docker logs oracle-xe | grep READY
```

### ORA-00923 (Missing FROM Clause)

> Caused by missing `FROM` in SQL statements (fixed in latest `demo_realtime.py`).

Ensure your local file has:

```sql
SELECT CAR_ID, ODOMETER_KM FROM CARS WHERE ...
```

### Permission Errors

> Run as the correct schema user (`raw_layer`, `silver_layer`, or `gold_layer`) and confirm grants:

```sql
GRANT CREATE TABLE, CREATE TRIGGER, CREATE SEQUENCE TO raw_layer;
```

---

## 📅 Full Workflow Summary

| Step | Action           | Command                                            |             |
| ---- | ---------------- | -------------------------------------------------- | ----------- |
| 1    | Start Oracle     | `docker compose -f oracle-compose.yml up -d`       |             |
| 2    | Check ready      | `docker logs -f oracle-xe                          | grep READY` |
| 3    | Create schemas   | `@src/database/scripts/oracle_medallion_setup.sql` |             |
| 4    | Load DDLs        | `@src/database/schema/*.sql`                       |             |
| 5    | Seed data        | `python src/generator/seed_static.py`              |             |
| 6    | Simulate rentals | `python src/generator/demo_realtime.py`            |             |

---

## 🌐 Result

You now have a fully initialized **Oracle Medallion Warehouse** with real-time data flow simulation.

* **RAW_LAYER**: transactional & IoT data (source-of-truth)
* **SILVER_LAYER**: cl
