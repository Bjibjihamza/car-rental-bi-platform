# 🚗 Car Rental BI Platform

A comprehensive Business Intelligence platform for car rental operations featuring real-time IoT telemetry, fleet management, and advanced analytics. Built with Oracle Database (Medallion Architecture), Node.js API, and React frontend.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Data Generation](#data-generation)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Technologies](#technologies)
- [Contributing](#contributing)

---

## 🎯 Overview

This platform provides end-to-end fleet management capabilities with:
- **Real-time IoT monitoring** of vehicle telemetry (GPS, speed, fuel, engine metrics)
- **Medallion architecture** (Bronze → Silver → Gold) for data quality and analytics
- **Multi-branch operations** across 5 major Moroccan cities
- **Role-based access control** (Supervisor, Branch Managers)
- **Live digital twin replay** from historical telemetry data

---

## 🏗️ Architecture

### Data Layers (Medallion)

```
┌─────────────┐
│   BRONZE    │  Raw ingestion (IoT sensors, transactions)
│ (RAW_LAYER) │  Tables: IOT_TELEMETRY, RENTALS, CARS, etc.
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   SILVER    │  Cleaned, validated, deduplicated
│(SILVER_LAYER)│  (Future ETL transformations)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    GOLD     │  Business aggregates, KPIs, analytics
│ (GOLD_LAYER)│  Optimized for reporting/dashboards
└─────────────┘
```

### Tech Stack

- **Database**: Oracle 21c XE (Pluggable Database: XEPDB1)
- **Backend API**: Node.js + Express + oracledb driver
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Data Generation**: Python (SQLAlchemy, Pandas, OSMnx for routing)
- **Containerization**: Docker + Docker Compose

---

## ✨ Features

### 🔐 Authentication & Authorization
- Supervisor (global access) and Branch Manager roles
- JWT-based session management
- Branch-scoped data isolation for managers

### 🚙 Fleet Management
- 55 vehicles across 5 branches (Casablanca, Rabat, Marrakech, Tangier, Agadir)
- 5 vehicle categories: Economy, SUV, Luxury, Van, Electric
- Real-time vehicle status tracking (Available, Rented, Maintenance)

### 📡 IoT Telemetry
- **30-second interval** data capture from 50 IoT devices
- Metrics: GPS coordinates, speed, acceleration, fuel level, engine temp, battery voltage
- Event types: `ENGINE_START`, `DRIVING`, `IDLE`, `ENGINE_STOP`, `REFUEL`
- OSM-based realistic route simulation with city-specific road networks

### 📊 Analytics & Reporting
- Rental performance by branch/category
- Fleet utilization rates
- Revenue analytics
- Maintenance alerts from telemetry anomalies

### 🎮 Live Monitor (Digital Twin)
- Real-time replay of historical telemetry via `RT_IOT_FEED` table
- Simulates live streaming with configurable speedup (1x, 2x, etc.)
- Synchronized rental status updates

---

## 📦 Prerequisites

- **Docker Desktop** (Windows/Mac) or Docker Engine (Linux)
- **Git**
- **Python 3.11+** (for data generation scripts)
- **Node.js 20+** (if running API/frontend outside Docker)

---

## 🚀 Installation

### 1. Clone Repository

```bash
git clone https://github.com/Bjibjihamza/car-rental-bi-platform.git
cd car-rental-bi-platform
```

### 2. Environment Configuration

Edit `.env` file (or keep defaults):

```bash
# Oracle Database
ORACLE_USER=raw_layer
ORACLE_PASSWORD=Raw#123
ORACLE_DSN=localhost:1521/XEPDB1

# API
API_PORT=5001
JWT_SECRET=your-secret-key-change-in-production

# Frontend
VITE_API_URL=http://localhost:5001/api
```

### 3. Start Services

```bash
docker compose up -d --build
```

This will:
- Pull Oracle 21c XE image (~2.7GB)
- Build API and frontend images
- Start 3 containers: `oracle-xe`, `api`, `frontend`

**Wait ~2 minutes** for Oracle to initialize. Check logs:

```bash
docker logs --tail 50 car-rental-bi-platform-oracle-xe-1
```

Look for: `DATABASE IS READY TO USE!`

---

## 🗄️ Database Setup

### Step 1: Create Medallion Schema

Connect as SYSTEM and provision RAW/SILVER/GOLD users:

```bash
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc \
  "sqlplus -s system/Admin#123@localhost:1521/XEPDB1 @/scripts/scripts/oracle_medallion_setup.sql"
```

**Creates**:
- 3 tablespaces: `raw_ts`, `silver_ts`, `gold_ts`
- 3 users: `raw_layer`, `silver_layer`, `gold_layer`

### Step 2: Build Bronze Layer Tables

```bash
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc \
  "sqlplus -s raw_layer/Raw#123@localhost:1521/XEPDB1 @/scripts/schema/bronze.sql"
```

**Creates** (in `RAW_LAYER` schema):
- `BRANCHES`, `MANAGERS`, `CAR_CATEGORIES`, `IOT_DEVICES`
- `CARS`, `CUSTOMERS`, `RENTALS`
- `IOT_TELEMETRY` (historical), `RT_IOT_FEED` (live buffer)
- `IOT_ALERTS`

### Step 3: Verify Schema

```bash
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc \
  "sqlplus raw_layer/Raw#123@localhost:1521/XEPDB1"
```

```sql
SELECT table_name FROM user_tables ORDER BY table_name;
-- Should list: BRANCHES, CARS, CUSTOMERS, IOT_DEVICES, IOT_TELEMETRY, MANAGERS, RENTALS, RT_IOT_FEED, etc.
```

---

## 🎲 Data Generation

### Prerequisites (Python Environment)

```bash
# Install Python dependencies
pip install pandas sqlalchemy oracledb osmnx networkx
```

### Script 1: Seed Static Data (`01_seed_static.py`)

Populates master data with realistic Moroccan context:

```bash
cd src/generator
python 01_seed_static.py
```

**Seeds**:
- ✅ **5 branches** (Casablanca HQ, Rabat Agdal, Marrakech Gueliz, Tangier Downtown, Agadir Plage)
- ✅ **11 managers** (1 Supervisor + 2 managers per branch)
- ✅ **50 IoT devices** (inactive until assigned to cars)
- ✅ **5 car categories** (Economy, SUV, Luxury, Van, Electric)
- ✅ **55 cars** with IoT device assignment → devices marked `ACTIVE`
- ✅ **50 customers**

**Run time**: ~10-15 seconds

### Script 2: Generate IoT Telemetry (`02_generate_iot_telemetry.py`)

Simulates 1 month of vehicle trips with realistic patterns:

```bash
python 02_generate_iot_telemetry.py
```

**Features**:
- **Time anchor**: Starts from `NOW + 5 minutes` (allows immediate streaming)
- **31 days forward** (~1 month)
- **Multi-day rentals**: 1, 2, 3, 5, 7, 10, 14-day durations
- **Trip distribution**: 40% no trips, 45% one trip, 15% two trips per day
- **Time windows**:
  - Hard window: 07:00–21:00 (no driving outside)
  - Soft forbidden (70% days): 04:00–08:00, 14:00–16:00 (early morning/lunch)
- **OSM routing**: Real road networks for each city
- **Physics simulation**: Speed, acceleration, fuel consumption, engine temp
- **15% fleet idle**: Some cars never rented (maintenance/parking)

**Output**: ~500K–1M rows in `IOT_TELEMETRY`

**Run time**: ~5-10 minutes (depends on CPU; OSM graph loading is cached)

### Script 3: Stream Live Data (`03_stream_iot_data.py`)

Replays historical telemetry into `RT_IOT_FEED` for real-time monitoring:

```bash
python 03_stream_iot_data.py
```

**Behavior**:
- **Replay window**: 30-second ticks (configurable)
- **Speedup**: `SPEEDUP=1.0` (real-time), `SPEEDUP=2.0` (2x faster)
- **Rental sync**: Auto-creates/closes rentals in `RENTALS` table
- **Unique rental IDs**: `(CAR_ID × 1000) + sim_rental_id` to avoid collisions
- **Loop**: When reaching end of telemetry, restarts from beginning

**Run in background**:
```bash
nohup python 03_stream_iot_data.py > stream.log 2>&1 &
```

---

## 📂 Project Structure

```
car-rental-bi-platform/
├── docker-compose.yml          # Orchestration (Oracle, API, Frontend)
├── .env                        # Environment variables
├── src/
│   ├── api/                    # Node.js REST API
│   │   ├── src/
│   │   │   ├── index.js        # Express app entry
│   │   │   ├── db.js           # Oracle connection pool
│   │   │   ├── authMiddleware.js
│   │   │   └── routes/         # API endpoints
│   │   │       ├── auth.js     # POST /api/auth/login
│   │   │       ├── branches.js # CRUD branches
│   │   │       ├── cars.js     # CRUD cars
│   │   │       ├── managers.js # CRUD managers
│   │   │       ├── rentals.js  # CRUD rentals
│   │   │       ├── devices.js  # CRUD IoT devices
│   │   │       ├── iotTelemetry.js  # GET telemetry
│   │   │       └── iotAlerts.js     # GET alerts
│   │   └── package.json
│   ├── frontend/               # React SPA
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Login.tsx
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── LiveMonitor.tsx   # RT_IOT_FEED polling
│   │   │   │   ├── Cars.tsx
│   │   │   │   ├── Rentals.tsx
│   │   │   │   └── ...
│   │   │   ├── components/     # Reusable UI (Sidebar, Topbar, Cards)
│   │   │   └── auth/           # AuthContext, ProtectedRoute
│   │   └── package.json
│   ├── database/
│   │   ├── schema/
│   │   │   ├── bronze.sql      # RAW_LAYER tables
│   │   │   ├── silver.sql      # (Future) SILVER_LAYER
│   │   │   └── gold.sql        # (Future) GOLD_LAYER
│   │   ├── scripts/
│   │   │   └── oracle_medallion_setup.sql  # User/tablespace provisioning
│   │   └── connexion/          # Python DB helpers
│   └── generator/              # Data generation scripts
│       ├── 01_seed_static.py
│       ├── 02_generate_iot_telemetry.py
│       ├── 03_stream_iot_data.py
│       └── cache/              # OSM graph cache (auto-generated)
└── README.md
```

---

## 🔌 API Documentation

Base URL: `http://localhost:5001/api`

### Authentication

#### POST `/auth/login`
```json
{
  "email": "hamza.supervisor@carrental.local",
  "password": "Admin#123"
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "managerId": 1,
    "email": "hamza.supervisor@carrental.local",
    "role": "SUPERVISOR",
    "branchId": null,
    "firstName": "Hamza",
    "lastName": "Bjibji"
  }
}
```

### Endpoints (Protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/branches` | List all branches |
| GET | `/cars` | List cars (filtered by branch for managers) |
| POST | `/cars` | Create new car |
| PUT | `/cars/:id` | Update car |
| GET | `/rentals` | List rentals |
| POST | `/rentals` | Create rental |
| GET | `/managers` | List managers (supervisor only) |
| GET | `/devices` | List IoT devices |
| GET | `/iot-telemetry` | Query telemetry (filters: carId, startDate, endDate) |
| GET | `/iot-alerts` | List alerts |

**Auth Header**: `Authorization: Bearer <token>`

---

## 💻 Technologies

### Backend
- **Node.js 20** (Bullseye base)
- **Express.js** - REST API framework
- **oracledb** - Native Oracle client
- **jsonwebtoken** - JWT authentication
- **bcryptjs** - Password hashing

### Frontend
- **React 18** + **TypeScript**
- **Vite** - Build tool
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Data visualization
- **Lucide React** - Icon library

### Database
- **Oracle 21c Express Edition**
- **Medallion Architecture** (Bronze/Silver/Gold)
- **Identity columns** (auto-increment PKs)
- **Partitioning-ready** (for future scale)

### DevOps
- **Docker Compose** - Multi-container orchestration
- **Python 3.11** - Data generation + ETL
- **OSMnx** - OpenStreetMap routing

---

## 🎓 Default Credentials

### Supervisor (Global Access)
- **Email**: `hamza.supervisor@carrental.local`
- **Password**: `Admin#123`

### Branch Managers (Examples)
- **Casablanca**: `amina.berrada@carrental.ma` / `pwd#Casa1`
- **Rabat**: `yassin.elidrissi@carrental.ma` / `pwd#Rabat1`
- **Marrakech**: `nadia.zerouali@carrental.ma` / `pwd#Mrk1`

*(See `01_seed_static.py` for full list)*

---

## 🛠️ Development

### Run API Locally (Without Docker)

```bash
cd src/api
npm install
node src/index.js
```

Ensure Oracle is running in Docker and accessible at `localhost:1521`.

### Run Frontend Locally

```bash
cd src/frontend
npm install
npm run dev
```

Access at `http://localhost:5173`

### Database Access

```bash
# SQL*Plus
docker exec -it car-rental-bi-platform-oracle-xe-1 bash -lc \
  "sqlplus raw_layer/Raw#123@localhost:1521/XEPDB1"

# SQL Developer / DBeaver
Host: localhost
Port: 1521
Service: XEPDB1
User: raw_layer
Password: Raw#123
```

---

## 📈 Future Enhancements

- [ ] **Silver Layer**: Implement cleaning/validation ETL jobs
- [ ] **Gold Layer**: Build aggregated fact tables (rental_facts, telemetry_summary)
- [ ] **Predictive Maintenance**: ML models on telemetry patterns
- [ ] **Mobile App**: React Native for field managers
- [ ] **Real IoT Integration**: MQTT broker for live device feeds
- [ ] **Multi-tenancy**: Support multiple rental companies

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/YourFeature`)
3. Commit changes (`git commit -m 'Add YourFeature'`)
4. Push to branch (`git push origin feature/YourFeature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👤 Author

**Hamza Bjibji**  
- GitHub: [@Bjibjihamza](https://github.com/Bjibjihamza)
- Email: hamza.supervisor@carrental.local

---

## 🙏 Acknowledgments

- Oracle Database XE for free edition
- OpenStreetMap contributors for routing data
- Moroccan car rental industry for domain inspiration

---

**Happy Fleet Managing! 🚗💨**