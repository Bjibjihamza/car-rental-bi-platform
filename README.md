# Oracle Docker README

---

# 📜 Load Schemas: `raw.sql`, `silver.sql`, `gold.sql`

> **PowerShell note:** the `@` symbol is special in PowerShell. Run SQL files via a shell inside the container to avoid parsing issues.

## 1) Copy the files into the container
```powershell
# from your project root
docker cp .\src\database\schema\raw.sql   oracle-xe:/tmp/raw.sql
docker cp .\src\database\schema\silver.sql oracle-xe:/tmp/silver.sql
docker cp .\src\database\schema\gold.sql   oracle-xe:/tmp/gold.sql
```

If you hit permissions issues:
```powershell
docker cp .\src\database\schema\raw.sql oracle-xe:/tmp/raw.sql.new
docker exec -u 0 -it oracle-xe bash -lc "mv -f /tmp/raw.sql.new /tmp/raw.sql && chown oracle:dba /tmp/raw.sql"
```

## 2) Ensure required privileges (once)
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

## 3) Run the scripts (recommended way)
```powershell
docker exec -it oracle-xe bash -lc "sqlplus raw_layer/Raw#123@localhost:1521/XEPDB1 @/tmp/raw.sql"
docker exec -it oracle-xe bash -lc "sqlplus silver_layer/Silver#123@localhost:1521/XEPDB1 @/tmp/silver.sql"
docker exec -it oracle-xe bash -lc "sqlplus gold_layer/Gold#123@localhost:1521/XEPDB1 @/tmp/gold.sql"
```

## 4) Verify objects
```powershell
docker exec -it oracle-xe sqlplus raw_layer/Raw#123@localhost:1521/XEPDB1
```
In SQL\*Plus:
```sql
SHOW USER;
SELECT object_type, COUNT(*) FROM user_objects GROUP BY object_type ORDER BY 1;
SELECT table_name FROM user_tables ORDER BY table_name;
```

## 5) Clean & reload (optional)
Clean RAW:
```powershell
docker exec -it oracle-xe sqlplus raw_layer/Raw#123@localhost:1521/XEPDB1
```
In SQL\*Plus (paste each block then `/`):
```sql
BEGIN FOR r IN (SELECT view_name FROM user_views) LOOP EXECUTE IMMEDIATE 'DROP VIEW "'||r.view_name||'"'; END LOOP; END; /
BEGIN FOR r IN (SELECT mview_name FROM user_mviews) LOOP EXECUTE IMMEDIATE 'DROP MATERIALIZED VIEW "'||r.mview_name||'"'; END LOOP; END; /
BEGIN FOR r IN (SELECT table_name FROM user_tables) LOOP EXECUTE IMMEDIATE 'DROP TABLE "'||r.table_name||'" CASCADE CONSTRAINTS PURGE'; END LOOP; END; /
BEGIN FOR r IN (SELECT sequence_name FROM user_sequences) LOOP EXECUTE IMMEDIATE 'DROP SEQUENCE "'||r.sequence_name||'"'; END LOOP; END; /
BEGIN FOR r IN (SELECT object_name, object_type FROM user_objects WHERE object_type IN ('PROCEDURE','FUNCTION','PACKAGE','PACKAGE BODY','TRIGGER','SYNONYM')) LOOP EXECUTE IMMEDIATE 'DROP '||r.object_type||' "'||r.object_name||'"'; END LOOP; END; /
```
Then re-run:
```powershell
docker exec -it oracle-xe bash -lc "sqlplus raw_layer/Raw#123@localhost:1521/XEPDB1 @/tmp/raw.sql"
```

