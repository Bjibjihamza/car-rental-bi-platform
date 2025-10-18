# 🚗 Car Rental BI Platform — Oracle Setup Guide

This project is the backend **data foundation** of the *Car Rental Business Intelligence Platform*, built to manage and analyze car rental operations using a **Medallion Data Architecture** (`Raw → Silver → Gold`) on **Oracle Database (XE 21c)**.

---

## 📦 1. Run Oracle Database in Docker

The first step is to create an Oracle Database container using Docker Compose.

### 🧩 Compose File
Make sure the file [`oracle-compose.yml`](./oracle-compose.yml) exists in the project root.

Once ready, open your terminal in the project folder and execute:

```bash
docker compose -f oracle-compose.yml up -d
```

This will:
- Download and start the **Oracle XE 21c** container (`gvenzl/oracle-xe:21`)
- Expose ports `1521` (SQL*Net listener) and `5500` (Enterprise Manager Express)
- Create a system password and an application user automatically

---

## 🔍 2. Check if the Database is Ready

You can verify that Oracle has finished initializing with:

```bash
docker logs -f oracle-xe | Select-String "DATABASE IS READY TO USE!"
```

Once you see this message, your container is running and ready for connections.

---

## 🧠 3. Connect to Oracle Database

Use `sqlplus` to access the Oracle Database inside the running container:

```bash
docker exec -it oracle-xe sqlplus system/Admin#123@localhost:1521/XEPDB1
```

> 🧩 **Note:**  
> - `system/Admin#123` = username/password  
> - `XEPDB1` = default pluggable database (PDB) name  

---

## 🧱 4. Medallion Architecture Setup (Raw → Silver → Gold)

Oracle supports multiple schemas for organizing your data warehouse stages.  
We’ll create three separate users corresponding to each layer of the pipeline:

- `RAW_USER` → stores raw ingested data  
- `SILVER_USER` → cleansed and transformed data  
- `GOLD_USER` → final analytics and BI tables  

### ⚙️ Setup Script

Run the following SQL script after connecting via `sqlplus`:

```bash
@src/database/oracle_medallion_setup.sql
```

This script:
- Creates the **RAW**, **SILVER**, and **GOLD** users/schemas
- Grants required privileges (including `CREATE TRIGGER`)
- Prepares the database for ETL workflows

---

## 📂 Project Structure

```
car-rental-bi-platform/
│
├── oracle-compose.yml                   # Docker setup for Oracle XE
├── README_Oracle_Docker.md              # Detailed Oracle setup guide
├── src/
│   ├── database/
│   │   ├── oracle_medallion_setup.sql   # Create schemas & users
│   │   ├── schema/
│   │   │   ├── raw.sql                  # RAW layer table definitions
│   │   │   ├── silver.sql               # SILVER layer transformations
│   │   │   └── gold.sql                 # GOLD layer analytics/BI views
│   │   └── scripts/
│   │       └── raw_scripts.sql          # Data generation scripts
│   └── generator/                       # Data generation (future ETL)
└── Documentation/                       # Docs, diagrams, etc.
```

---

# 📜 Load Schemas: `raw.sql`, `silver.sql`, `gold.sql`

> **PowerShell note:** the `@` symbol is special in PowerShell. Run SQL files via a shell inside the container to avoid parsing issues.

## 1️⃣ Copy the files into the container
```powershell
# from your project root
docker cp .\src\database\schema\raw.sql    oracle-xe:/tmp/raw.sql
docker cp .\src\database\schema\silver.sql oracle-xe:/tmp/silver.sql
docker cp .\src\database\schema\gold.sql   oracle-xe:/tmp/gold.sql
```

If you hit permissions issues:
```powershell
docker cp .\src\database\schema\raw.sql oracle-xe:/tmp/raw.sql.new
docker exec -u 0 -it oracle-xe bash -lc "mv -f /tmp/raw.sql.new /tmp/raw.sql && chown oracle:dba /tmp/raw.sql"
```

---

## 2️⃣ Ensure required privileges (once)
As SYSTEM:
```powershell
docker exec -it oracle-xe sqlplus system/Admin#123@localhost:1521/XEPDB1
```

In SQL*Plus:
```sql
GRANT CREATE TRIGGER TO raw_layer;
GRANT CREATE TRIGGER TO silver_layer;
GRANT CREATE TRIGGER TO gold_layer;
```

---

## 3️⃣ Run the scripts (recommended way)
```powershell
docker exec -it oracle-xe bash -lc "sqlplus raw_layer/Raw#123@localhost:1521/XEPDB1 @/tmp/raw.sql"
docker exec -it oracle-xe bash -lc "sqlplus silver_layer/Silver#123@localhost:1521/XEPDB1 @/tmp/silver.sql"
docker exec -it oracle-xe bash -lc "sqlplus gold_layer/Gold#123@localhost:1521/XEPDB1 @/tmp/gold.sql"
```

---

## 4️⃣ Verify objects
```powershell
docker exec -it oracle-xe sqlplus raw_layer/Raw#123@localhost:1521/XEPDB1
```

In SQL*Plus:
```sql
SHOW USER;
SELECT object_type, COUNT(*) FROM user_objects GROUP BY object_type ORDER BY 1;
SELECT table_name FROM user_tables ORDER BY table_name;
```

---

## 5️⃣ Clean & reload (optional)
Clean RAW layer:
```powershell
docker exec -it oracle-xe sqlplus raw_layer/Raw#123@localhost:1521/XEPDB1
```

In SQL*Plus (paste each block then `/`):
```sql
BEGIN FOR r IN (SELECT view_name FROM user_views) LOOP EXECUTE IMMEDIATE 'DROP VIEW '||r.view_name; END LOOP; END; /
BEGIN FOR r IN (SELECT mview_name FROM user_mviews) LOOP EXECUTE IMMEDIATE 'DROP MATERIALIZED VIEW '||r.mview_name; END LOOP; END; /
BEGIN FOR r IN (SELECT table_name FROM user_tables) LOOP EXECUTE IMMEDIATE 'DROP TABLE '||r.table_name||' CASCADE CONSTRAINTS PURGE'; END LOOP; END; /
BEGIN FOR r IN (SELECT sequence_name FROM user_sequences) LOOP EXECUTE IMMEDIATE 'DROP SEQUENCE '||r.sequence_name; END LOOP; END; /
BEGIN FOR r IN (SELECT object_name, object_type FROM user_objects WHERE object_type IN ('PROCEDURE','FUNCTION','PACKAGE','PACKAGE BODY','TRIGGER','SYNONYM')) LOOP EXECUTE IMMEDIATE 'DROP '||r.object_type||' '||r.object_name; END LOOP; END; /
```
Then re-run:
```powershell
docker exec -it oracle-xe bash -lc "sqlplus raw_layer/Raw#123@localhost:1521/XEPDB1 @/tmp/raw.sql"
```

---

## 📥 Seed Initial RAW Data

These steps load a small initial dataset (données initiales) into the RAW layer. Future/streaming data will be synthetically generated in near real time (données synthétiques en temps réel).

### 1) Copy the updated seed file into the container
```powershell
# from your project root
docker cp raw_seed.sql oracle-xe:/tmp/raw_seed.sql
```

### 2) (Optional) Cleanup before reseeding

If you’re reseeding, wipe dependent tables in a safe order:

Connect as RAW user first (see commands below), then run:

```sql
DELETE FROM IoT_Data;
DELETE FROM IoT_Alerts;
DELETE FROM car_telemetry;
DELETE FROM Trips;

DELETE FROM Payments;
DELETE FROM Maintenance;
DELETE FROM Damages;

DELETE FROM Rentals;
DELETE FROM Reservations;

DELETE FROM Cars;
DELETE FROM Managers;
DELETE FROM IoT_Devices;
DELETE FROM Car_Categories;
DELETE FROM Branches;

COMMIT;
```

💡 **Tip (idempotence):** To avoid duplicate branches when reseeding, you can add once:

```sql
ALTER TABLE Branches ADD CONSTRAINT uq_branches_name UNIQUE (branch_name);
```

### 3) Run the seed
```powershell
docker exec -it oracle-xe bash -lc "sqlplus raw_layer/Raw#123@localhost:1521/XEPDB1 @/tmp/raw_seed.sql"
```

### 4) Verify quickly
```powershell
docker exec -it oracle-xe sqlplus raw_layer/Raw#123@localhost:1521/XEPDB1
```

In SQL*Plus:

```sql
-- Counts expected after seed
SELECT (SELECT COUNT(*) FROM Branches)        AS branches,
       (SELECT COUNT(*) FROM Managers)        AS managers,
       (SELECT COUNT(*) FROM Car_Categories)  AS categories,
       (SELECT COUNT(*) FROM IoT_Devices)     AS iot_devices,
       (SELECT COUNT(*) FROM Cars)            AS cars
FROM dual;

-- Available cars + IoT view should return rows
SELECT * FROM Available_Cars_With_IoT FETCH FIRST 10 ROWS ONLY;
```

📊 **What this seed inserts (RAW)**

- **Branches** — 5 branches (Casablanca HQ, Rabat Agdal, Tangier Downtown, Marrakech Gueliz, Fes Medina).
- **Managers** — 15 managers distributed across branches (FK branch_id, email unique).
- **Car_Categories** — 6 categories (Economy, Compact, SUV, Luxury, Van, Electric).
- **IoT_Devices** — 50 telemetry devices (IOT-MA-0001 … IOT-MA-0050, serial unique).
- **Cars** — 50 vehicles mapped to categories, branches, and IoT devices (status, rates, service dates).

ℹ️ **Ces données sont de démarrage (initial seed) pour la couche RAW.**  
L’autre data (réservations, locations, télémétrie IoT, paiements, alertes, etc.) sera générée de façon synthétique en temps réel par nos scripts/ingestions lors des tests et démonstrations.

🔐 **Connect refs (for convenience)**

```powershell
# SYSTEM (admin)
docker exec -it oracle-xe sqlplus system/Admin#123@localhost:1521/XEPDB1

# RAW/SILVER/GOLD schemas
docker exec -it oracle-xe bash -lc "sqlplus raw_layer/Raw#123@localhost:1521/XEPDB1"
docker exec -it oracle-xe bash -lc "sqlplus silver_layer/Silver#123@localhost:1521/XEPDB1"
docker exec -it oracle-xe bash -lc "sqlplus gold_layer/Gold#123@localhost:1521/XEPDB1"
```

🧪 **Next up: synthetic real-time data**

Generators will stream IoT telemetry, reservations, rentals, payments, and alerts into RAW.

Scheduled/streaming jobs will transform RAW → SILVER → GOLD for analytics and dashboards.

If you want, add a tiny PowerShell script (`/src/database/scripts/seed.ps1`) that runs the copy + optional cleanup + seed in one go.

---

## 🧪 Version Control & Collaboration

To version and push your Oracle setup files to GitHub:

```bash
git add .
git commit -m "🔧 Oracle Medallion setup + RAW/SILVER/GOLD schemas added"
git push origin main
```

> 💡 **Tip:** To avoid line-ending warnings (`LF will be replaced by CRLF`):
> ```bash:disable-run
> git config core.autocrlf false
> ```

---

## 🧪 Next Steps
After database setup:
1. Add your ETL scripts for **Raw → Silver → Gold** processing.
2. Integrate with analytics or BI visualization layers.
3. Automate refresh and monitoring with Python or Airflow.

---

## 🧮 Requirements

- **Docker & Docker Compose**
- **Oracle XE 21c image** (`gvenzl/oracle-xe:21`)
- **SQL*Plus** client (included in container)
- **Windows PowerShell** (for `Select-String` usage)

---

© 2025 – Car Rental BI Platform | Data Engineering & BI by Hamza
```