# 🚗 Car Rental BI Platform (Oracle + Node API + React Dashboard)

A full-stack **Car Rental BI Platform** running on:

* **Oracle XE 21c (gvenzl/oracle-xe:21)** in Docker
* **Node.js API (Express + oracledb)** in Docker
* **React + Vite + Tailwind frontend** in Docker
* Optional **Python generator** to seed and simulate data (raw layer)

This project follows a **Medallion Architecture** idea (Bronze / Silver / Gold) inside Oracle, with the **RAW layer** acting as the operational base.

---

## ✅ Project Structure (Updated)

```
car-rental-bi-platform/
├─ docker-compose.yml
├─ .env
├─ README.md
└─ src/
   ├─ api/                 # Node API (Express + Oracle)
   │  ├─ Dockerfile
   │  ├─ package.json
   │  └─ src/
   │     ├─ index.js
   │     ├─ db.js
   │     └─ routes/
   │        └─ cars.js
   ├─ frontend/            # React + Vite + Tailwind
   │  ├─ Dockerfile
   │  ├─ vite.config.ts
   │  └─ src/...
   ├─ database/            # Oracle scripts
   │  ├─ scripts/
   │  │  └─ oracle_medallion_setup.sql
   │  └─ schema/
   │     ├─ bronze.sql
   │     ├─ silver.sql
   │     ├─ gold.sql
   │     └─ Truncate.sql
   ├─ generator/           # Python seed + realtime simulation
   └─ Notebooks/
```

---

## 🔧 Requirements

### Required

* Docker Desktop
* Docker Compose (comes with Docker Desktop)

### Optional (for data generation / seeding)

* Python 3.9+
* `pip install pandas sqlalchemy oracledb`

---

## 🌍 Service Ports

| Service    | URL / Port                                     |
| ---------- | ---------------------------------------------- |
| Frontend   | [http://localhost:5173](http://localhost:5173) |
| API        | [http://localhost:8000](http://localhost:8000) |
| Oracle SQL | localhost:1521                                 |
| Oracle EM  | [http://localhost:5500](http://localhost:5500) |

---

## 🚀 1) Start Everything (Oracle + API + Frontend)

From project root:

### ✅ Windows PowerShell

```powershell
docker compose up -d --build
```

### ✅ Linux / macOS

```bash
docker compose up -d --build
```

Check running containers:

```powershell
docker ps
```

Expected:

* `car-rental-bi-platform-oracle-xe-1` (healthy)
* `car-rental-bi-platform-api-1`
* `car-rental-bi-platform-frontend-1`

---

## 🧼 2) Full Reset (Remove DB volume + rebuild)

Use this when you want a clean DB from scratch.

### Windows / Linux / macOS

```bash
docker compose down -v
docker compose up -d --build
```

⚠️ `-v` deletes Oracle data volume (full reset).

---

## 🧠 3) Verify Oracle is Ready

### View logs

```powershell
docker logs --tail 200 car-rental-bi-platform-oracle-xe-1
```

### Verify health

```powershell
docker inspect --format='{{json .State.Health}}' car-rental-bi-platform-oracle-xe-1
```

---

## 🔌 4) Connect to Oracle (Inside Container)

### Connect as SYSTEM

```powershell
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc "sqlplus system/Admin#123@localhost:1521/XEPDB1"
```

### Connect as RAW user (after setup)

```powershell
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc "sqlplus raw_layer/Raw#123@localhost:1521/XEPDB1"
```

> Your PDB is **XEPDB1** (you verified `CON_NAME = XEPDB1`).

---

## 🏗️ 5) Run Medallion Setup Script (Create Users + Tablespaces)

This creates (or ensures) medallion users like `RAW_LAYER`, `SILVER_LAYER`, `GOLD_LAYER`, plus grants.

### Run script:

```powershell
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc "sqlplus -s system/Admin#123@localhost:1521/XEPDB1 @/scripts/scripts/oracle_medallion_setup.sql"
```

✅ You should see:

* Tablespace created
* User created
* Grants succeeded

---

## 📜 6) Run Schema Scripts (Bronze / Silver / Gold)

### 6.1 Bronze (RAW schema / operational tables)

```powershell
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc "sqlplus -s raw_layer/Raw#123@localhost:1521/XEPDB1 @/scripts/schema/bronze.sql"
```

### 6.2 Silver

```powershell
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc "sqlplus -s silver_layer/Silver#123@localhost:1521/XEPDB1 @/scripts/schema/silver.sql"
```

### 6.3 Gold

```powershell
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc "sqlplus -s gold_layer/Gold#123@localhost:1521/XEPDB1 @/scripts/schema/gold.sql"
```

---

## ✅ 7) Validate Tables Exist

Run inside Oracle:

```powershell
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc "sqlplus -s raw_layer/Raw#123@localhost:1521/XEPDB1 <<'SQL'
set pages 200 lines 200
select table_name from user_tables order by table_name;
SQL"
```

Check counts:

```powershell
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc "sqlplus -s raw_layer/Raw#123@localhost:1521/XEPDB1 <<'SQL'
set pages 200 lines 200
select count(*) as cars_count from cars;
select count(*) as branches_count from branches;
SQL"
```

---

## 🌱 8) Seed Static Data (Cars, Branches, Managers, Devices)

You currently seed using Python (SQLAlchemy + oracledb).
**Important detail:** your Python script connects to `localhost:1521/XEPDB1`, so it seeds the Oracle container through the mapped port.

### Option A — Run locally (recommended)

From project root (on host machine):

```bash
python src/generator/seed_static.py
```

(or run the notebook/script you already have)

### Verify seed worked:

```powershell
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc "sqlplus -s raw_layer/Raw#123@localhost:1521/XEPDB1 <<'SQL'
set pages 200 lines 200
select count(*) cars_count from cars;
select car_id, make, model, branch_id from cars fetch first 5 rows only;
SQL"
```

Expected: `CARS_COUNT = 55` (or more)

---

## 🧪 9) Test the API (Health + Cars)

### 9.1 Health endpoint

```powershell
curl http://localhost:8000/health
```

Expected:

```json
{"status":"ok"}
```

### 9.2 Cars endpoint

```powershell
curl http://localhost:8000/api/v1/cars
```

Expected: JSON array (55 rows)

---

## 🧩 10) Ensure API reads from Oracle (Important)

Your API must:

* Create Oracle pool from env vars:

  * `ORACLE_HOST=oracle-xe`
  * `ORACLE_PORT=1521`
  * `ORACLE_SERVICE=XEPDB1`
  * `ORACLE_USER=raw_layer`
  * `ORACLE_PASSWORD=Raw#123`

Check env inside API container:

```powershell
docker exec -it car-rental-bi-platform-api-1 bash -lc "printenv | grep -E 'ORACLE_|PORT' | sort"
```

---

## 🖥️ 11) Frontend (React + Tailwind) Usage

Open:

* [http://localhost:5173](http://localhost:5173)

The frontend calls API:

* [http://localhost:8000/api/v1/cars](http://localhost:8000/api/v1/cars)

If you see CORS errors:

* Confirm API `cors()` allows `http://localhost:5173`
* Confirm frontend uses correct base URL (`http://localhost:8000`)

---

## 🧨 12) TRUNCATE / Reset Tables (SQL Script)

If you want to clean tables quickly (without deleting volume):

```powershell
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc "sqlplus -s raw_layer/Raw#123@localhost:1521/XEPDB1 @/scripts/schema/Truncate.sql"
```

Then reseed.

---

## 🐳 13) Docker Compose Workflow (Daily Dev)

### Start

```powershell
docker compose up -d --build
```

### Stop (keep DB)

```powershell
docker compose down
```

### Stop + delete DB (hard reset)

```powershell
docker compose down -v
```

### Rebuild only API

```powershell
docker compose build api
docker compose up -d api
```

### View API logs

```powershell
docker logs --tail 200 -f car-rental-bi-platform-api-1
```

---

## 🧠 14) PowerShell Gotchas (VERY IMPORTANT)

### ✅ PowerShell is NOT CMD

* CMD uses `^` for multiline
* PowerShell uses backtick `` ` ``

So **DO NOT** do:

```powershell
docker exec ... ^
```

Instead:

* Use **single line commands** (recommended)
* Or use backtick:

```powershell
docker exec -it car-rental-bi-platform-oracle-xe-1 `
  bash -lc "sqlplus ..."
```

---

## 🧯 15) Troubleshooting

### A) API keeps restarting

Check logs:

```powershell
docker logs --tail 200 car-rental-bi-platform-api-1
```

Common causes:

* Mixed ES Modules and CommonJS (`import` + `require`)
* Wrong db connect string
* Missing oracledb dependency

Fix:

* Use one module style consistently (CommonJS everywhere is easiest)

---

### B) API returns `[]` but Oracle has data

Check:

1. Oracle has rows:

```powershell
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc "sqlplus -s raw_layer/Raw#123@localhost:1521/XEPDB1 <<'SQL'
select count(*) as cars_count from cars;
SQL"
```

2. API is connected to correct schema:

* In API query: `SELECT COUNT(*) FROM CARS`
* If your query uses `RAW_LAYER.CARS`, confirm schema name case is correct

3. Confirm Node `oracledb.outFormat = OUT_FORMAT_OBJECT`
   So results return as objects not arrays.

---

### C) Oracle container unhealthy after rebuild

Often happens when the DB is still initializing.
Wait and re-check:

```powershell
docker logs -f car-rental-bi-platform-oracle-xe-1
```

If you want a clean reinit:

```powershell
docker compose down -v
docker compose up -d --build
```

---

### D) CORS blocked from frontend

Ensure API has:

```js
cors({ origin: ["http://localhost:5173"], credentials: true })
```

Ensure frontend calls correct URL `http://localhost:8000`.

---

## ✅ Full Setup Checklist (Quick)

1. Start services:

   ```bash
   docker compose up -d --build
   ```
2. Run medallion setup:

   ```bash
   docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc "sqlplus -s system/Admin#123@localhost:1521/XEPDB1 @/scripts/scripts/oracle_medallion_setup.sql"
   ```
3. Run bronze schema:

   ```bash
   docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc "sqlplus -s raw_layer/Raw#123@localhost:1521/XEPDB1 @/scripts/schema/bronze.sql"
   ```
4. Seed data:

   ```bash
   python src/generator/seed_static.py
   ```
5. Test API:

   ```bash
   curl http://localhost:8000/health
   curl http://localhost:8000/api/v1/cars
   ```
6. Open frontend:

   * [http://localhost:5173](http://localhost:5173)

---

## 🧾 Notes

* Oracle scripts are mounted inside the container at `/scripts`
  because docker-compose maps:

  * `./src/database:/scripts`

So:

* Host: `src/database/schema/bronze.sql`
* Container: `/scripts/schema/bronze.sql`