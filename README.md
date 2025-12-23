# 🚗 Car Rental BI Platform

A comprehensive Business Intelligence platform for car rental operations featuring real-time IoT telemetry, fleet management, and advanced analytics. Built with Oracle Database (Medallion Architecture), Node.js API, and React frontend.

## 📋 Table of Contents

* [Overview](#overview)
* [Architecture](#architecture)
* [Features](#features)
* [Prerequisites](#prerequisites)
* [Installation](#installation)
* [Database Setup](#database-setup)
* [Data Generation](#data-generation)
* [Project Structure](#project-structure)
* [API Documentation](#api-documentation)
* [Technologies](#technologies)
* [Contributing](#contributing)

---

## 🎯 Overview

This platform provides end-to-end fleet management capabilities with:

* **Real-time IoT monitoring** of vehicle telemetry (GPS, speed, fuel, engine metrics)
* **Medallion architecture** (Bronze → Silver → Gold) for data quality and analytics
* **Multi-branch operations** across 5 major Moroccan cities
* **Role-based access control** (Supervisor, Branch Managers)
* **Live digital twin replay** from telemetry data (live buffer)

> **Current project mode (Synthetic Data):**
> We temporarily **skip Bronze ingestion**. The operational model is created directly in **Silver** using `silver.sql`, and analytics are built in **Gold** using `gold.sql`.

---

## 🏗️ Architecture

### Data Layers (Medallion)

```
┌─────────────┐
│   BRONZE    │  (Empty for now)
│ (RAW_LAYER) │  Will be used when real ingestion is added
└──────┬──────┘
       │ (future ETL)
       ▼
┌─────────────┐
│   SILVER    │  Operational model (synthetic demo data)
│(SILVER_LAYER)│  Tables: BRANCHES, CARS, RENTALS, IOT_TELEMETRY, RT_IOT_FEED...
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    GOLD     │  BI-ready facts, dimensions, KPIs, wide views
│ (GOLD_LAYER)│  Optimized for reporting/dashboards
└─────────────┘
```

### Tech Stack

* **Database**: Oracle 21c XE (Pluggable DB: XEPDB1)
* **Backend API**: Node.js + Express + oracledb driver
* **Frontend**: React + TypeScript + Vite + Tailwind CSS
* **Data Generation**: Python (synthetic seed + live simulator)
* **Containerization**: Docker + Docker Compose

---

## ✨ Features

### 🔐 Authentication & Authorization

* Supervisor (global access) and Branch Manager roles
* JWT-based session management
* Branch-scoped data isolation for managers

### 🚙 Fleet Management

* Vehicles across branches (Casablanca, Rabat, Marrakech, Tangier, Agadir)
* Multiple vehicle categories: Economy, SUV, Luxury, Van, Electric
* Vehicle status tracking (Available, Rented, Maintenance)

### 📡 IoT Telemetry

* Telemetry metrics: GPS, speed, acceleration, fuel, engine temperature, odometer
* Real-time buffer table: `RT_IOT_FEED`
* Historical telemetry table: `IOT_TELEMETRY`

### 📊 Analytics & Reporting (Gold)

* Gold Dimensions: Date, Branch, Manager, Category, Car, Customer, Device
* Gold Facts: Rentals, Alerts, Telemetry Daily, Car Status Snap Daily
* Wide BI Views and KPI Views (dashboards-ready)

### 🎮 Live Monitor (Digital Twin)

* Live “stream” simulation into `RT_IOT_FEED`
* Used by Live Monitor page for near-real-time experience

---

## 📦 Prerequisites

* **Docker Desktop** (Windows/Mac) or Docker Engine (Linux)
* **Git**
* **Python 3.11+** (for generator scripts)
* **Node.js 20+** (if running API/frontend outside Docker)

---

## 🚀 Installation

### 1. Clone Repository

```bash
git clone https://github.com/Bjibjihamza/car-rental-bi-platform.git
cd car-rental-bi-platform
```

### 2. Environment Configuration

Edit `.env` (or keep defaults):

```bash
# Oracle Database
ORACLE_USER=silver_layer
ORACLE_PASSWORD=Silver#123
ORACLE_DSN=localhost:1521/XEPDB1

# API
API_PORT=5001
JWT_SECRET=your-secret-key-change-in-production

# Frontend
VITE_API_URL=http://localhost:5001/api
```

> Note: **App should connect to SILVER** (current working layer for synthetic data).

### 3. Start Services

```bash
docker compose up -d --build
```

Wait for Oracle to initialize:

```bash
docker logs --tail 50 car-rental-bi-platform-oracle-xe-1
```

Look for: `DATABASE IS READY TO USE!`

---

## 🗄️ Database Setup

### Step 1: Create Medallion Users & Tablespaces

This creates: `RAW_LAYER`, `SILVER_LAYER`, `GOLD_LAYER` + their tablespaces.

```bash
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc \
  "sqlplus -s system/Admin#123@localhost:1521/XEPDB1 @/scripts/scripts/oracle_medallion_setup.sql"
```

### Step 2: Build SILVER Layer (Operational Model)

⚠️ **Bronze is intentionally empty** for now.
We create all operational tables directly in `SILVER_LAYER`:

```bash
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc \
  "sqlplus -s silver_layer/Silver#123@localhost:1521/XEPDB1 @/scripts/schema/silver.sql"
```

**Creates (in SILVER_LAYER):**

* `BRANCHES`, `MANAGERS`, `CAR_CATEGORIES`, `IOT_DEVICES`
* `CARS`, `CUSTOMERS`, `RENTALS`
* `IOT_TELEMETRY` (historical telemetry)
* `RT_IOT_FEED` (real-time buffer)
* `IOT_ALERTS`
* * seeds default Supervisor in `MANAGERS`

### Step 3: Build GOLD Layer (Analytics)

Deploy Gold (facts, dims, views, KPI views, package loader):

```bash
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc \
  "sqlplus -s gold_layer/Gold#123@localhost:1521/XEPDB1 @/scripts/schema/gold.sql"
```

✅ You should see:

* `[OK] Dimensions created`
* `[OK] Facts created`
* `[OK] Gold wide views created`
* `[OK] KPI views created`
* `[OK] GOLD layer fully deployed`

### Step 4: Quick Verification

```bash
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc \
  "sqlplus -s silver_layer/Silver#123@localhost:1521/XEPDB1 <<'SQL'
  SET PAGESIZE 200
  SELECT table_name FROM user_tables ORDER BY table_name;
  SQL"
```

---

## 🎲 Data Generation (Synthetic)

### Python Dependencies

```bash
pip install pandas sqlalchemy oracledb
```

> We currently use **only**:

* `01_seed_static.py`
* `04_live_iot_simulator.py`

### Script 1: Seed Static Data (`01_seed_static.py`)

```bash
cd src/generator
python 01_seed_static.py
```

Seeds:

* Branches, Managers, Categories, Devices, Cars, Customers

### Script 2: Live IoT Simulation (`04_live_iot_simulator.py`)

This script simulates “live telemetry” by pushing rows into `RT_IOT_FEED` (and optionally telemetry history depending on script behavior).

```bash
python 04_live_iot_simulator.py
```

> Use this for the Live Monitor page.

---

## 📂 Project Structure

```
car-rental-bi-platform/
├── docker-compose.yml
├── .env
├── src/
│   ├── api/
│   ├── frontend/
│   ├── database/
│   │   ├── schema/
│   │   │   ├── bronze.sql        # (kept, but not used in synthetic mode)
│   │   │   ├── silver.sql        # SILVER operational schema (CURRENT)
│   │   │   ├── gold.sql          # GOLD full deployment (CURRENT)
│   │   │   └── gold/             # modular gold scripts (0..6 + run_all)
│   │   ├── scripts/
│   │   │   └── oracle_medallion_setup.sql
│   │   └── connexion/
│   └── generator/
│       ├── 01_seed_static.py
│       ├── 02_generate_iot_telemetry.py   # (not used currently)
│       ├── 03_stream_iot_data.py          # (not used currently)
│       ├── 04_live_iot_simulator.py       # CURRENT
│       └── seed_data.json
└── README.md
```

---

## 🔌 API Documentation

Base URL: `http://localhost:5001/api`

> **Important (Today’s change):** API should read from **SILVER_LAYER** (not RAW_LAYER).
> Next step is to update routes/queries accordingly.

### Authentication

#### POST `/auth/login`

```json
{
  "email": "hamzabjibji@gmail.com",
  "password": "Admin#123"
}
```

---

## 💻 Technologies

### Backend

* Node.js 20
* Express.js
* oracledb
* jsonwebtoken
* bcryptjs

### Frontend

* React 18 + TypeScript
* Vite
* Tailwind CSS
* Recharts

### Database

* Oracle 21c XE
* Medallion Architecture
* Identity columns

### DevOps

* Docker Compose
* Python 3.11

---

## 📈 Roadmap

* [ ] Bronze ingestion (real data)
* [ ] Silver ETL from Bronze (validation/dedup)
* [ ] Expand Gold KPIs & dashboards
* [ ] Predictive maintenance models
* [ ] MQTT / real IoT integration

---

## 🤝 Contributing

1. Fork
2. Feature branch
3. Commit
4. Push
5. PR

---

## 👤 Author

**Hamza Bjibji**

* GitHub: `@Bjibjihamza`
* Email: `hamzabjibji@gmail.com`

---

**Happy Fleet Managing! 🚗💨**

---
