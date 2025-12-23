-- ======================================================================
-- 1_drop.sql — Idempotent drop (tables/views/packages)
-- ======================================================================
WHENEVER SQLERROR CONTINUE
SET DEFINE OFF
ALTER SESSION SET CURRENT_SCHEMA = GOLD_LAYER;

BEGIN
  -- Drop views first
  FOR v IN (
    SELECT view_name
    FROM user_views
    WHERE view_name IN (
      'VW_GOLD_RENTALS','VW_GOLD_CARS','VW_GOLD_CUSTOMERS','VW_GOLD_DEVICES','VW_GOLD_ALERTS',
      'VW_KPI_RENTALS_DAILY','VW_KPI_BRANCH_UTILIZATION_DAILY','VW_KPI_CAR_UTILIZATION_DAILY',
      'VW_KPI_ALERTS_DAILY','VW_KPI_TELEMETRY_DAILY','VW_KPI_LIVE_CAR_STATUS'
    )
  ) LOOP
    EXECUTE IMMEDIATE 'DROP VIEW '||v.view_name;
  END LOOP;

  -- Drop package
  FOR p IN (
    SELECT object_name
    FROM user_objects
    WHERE object_type = 'PACKAGE'
      AND object_name IN ('PKG_GOLD_LOAD')
  ) LOOP
    EXECUTE IMMEDIATE 'DROP PACKAGE '||p.object_name;
  END LOOP;

  -- Drop tables
  FOR t IN (
    SELECT table_name
    FROM user_tables
    WHERE table_name IN (
      'DIM_DATE','DIM_BRANCH','DIM_MANAGER','DIM_CATEGORY','DIM_CAR','DIM_CUSTOMER','DIM_DEVICE',
      'FACT_RENTAL','FACT_IOT_ALERT','FACT_TELEMETRY_DAILY','FACT_CAR_STATUS_SNAP_DAILY'
    )
  ) LOOP
    EXECUTE IMMEDIATE 'DROP TABLE '||t.table_name||' CASCADE CONSTRAINTS PURGE';
  END LOOP;
END;
/
COMMIT;

PROMPT [OK] Drop phase done
