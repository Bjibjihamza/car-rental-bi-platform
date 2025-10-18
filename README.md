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
- Grants required privileges
- Prepares the database for ETL workflows

---

## 📂 Project Structure

```
car-rental-bi-platform/
│
├── oracle-compose.yml              # Docker setup for Oracle XE
├── README_Oracle_Docker.md         # Detailed Docker guide
├── src/
│   ├── database/
│   │   ├── oracle_medallion_setup.sql   # Create schemas & users
│   │   ├── schema/
│   │   │   └── raw.sql                  # Raw layer table definitions
│   │   └── scripts/
│   │       └── raw_scripts.sql          # Data generation scripts
│   └── generator/                       # Data generation (future ETL)
└── Documentation/                       # Docs, diagrams, etc.
```

---

## 🧪 Next Steps

After database setup:
1. Add your ETL scripts for **Raw → Silver → Gold** processing.
2. Integrate with analytics or BI visualization layers.
3. Automate refresh and monitoring with Python or Airflow.

---

## 🧰 Requirements

- **Docker & Docker Compose**
- **Oracle XE 21c image** (`gvenzl/oracle-xe:21`)
- **SQL*Plus** client (included in container)
- Windows PowerShell (for `Select-String` usage)

---

© 2025 – Car Rental BI Platform | Data Engineering & BI by Hamza