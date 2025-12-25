-- ============================================================================
-- Oracle Medallion Setup Script (RAW / SILVER / GOLD) - IDEMPOTENT
-- Project: Car-Rental BI Platform
-- Target: Oracle Database 21c XE (Pluggable DB: XEPDB1)
--
-- PURPOSE
--   Create (if missing):
--     Tablespaces: RAW_TS, SILVER_TS, GOLD_TS
--     Users      : RAW_LAYER, SILVER_LAYER, GOLD_LAYER
--   Then grant required privileges (re-applied every run).
-- ============================================================================

SET SERVEROUTPUT ON
WHENEVER SQLERROR EXIT SQL.SQLCODE

PROMPT == Current container ==
SHOW CON_NAME;

-- If not XEPDB1, uncomment:
-- ALTER SESSION SET CONTAINER = XEPDB1;

-- ============================================================================
-- Helpers (idempotent create)
-- ============================================================================

DECLARE
  v_cnt NUMBER;
BEGIN
  -- ==========================================================================
  -- 1) TABLESPACES
  -- ==========================================================================

  SELECT COUNT(*) INTO v_cnt FROM dba_tablespaces WHERE tablespace_name = 'RAW_TS';
  IF v_cnt = 0 THEN
    DBMS_OUTPUT.PUT_LINE('Creating tablespace RAW_TS...');
    EXECUTE IMMEDIATE q'[
      CREATE TABLESPACE raw_ts
        DATAFILE 'raw_ts.dbf'
        SIZE 100M
        AUTOEXTEND ON NEXT 50M
        SEGMENT SPACE MANAGEMENT AUTO
    ]';
  ELSE
    DBMS_OUTPUT.PUT_LINE('Tablespace RAW_TS already exists. Skipping.');
  END IF;

  SELECT COUNT(*) INTO v_cnt FROM dba_tablespaces WHERE tablespace_name = 'SILVER_TS';
  IF v_cnt = 0 THEN
    DBMS_OUTPUT.PUT_LINE('Creating tablespace SILVER_TS...');
    EXECUTE IMMEDIATE q'[
      CREATE TABLESPACE silver_ts
        DATAFILE 'silver_ts.dbf'
        SIZE 100M
        AUTOEXTEND ON NEXT 50M
        SEGMENT SPACE MANAGEMENT AUTO
    ]';
  ELSE
    DBMS_OUTPUT.PUT_LINE('Tablespace SILVER_TS already exists. Skipping.');
  END IF;

  SELECT COUNT(*) INTO v_cnt FROM dba_tablespaces WHERE tablespace_name = 'GOLD_TS';
  IF v_cnt = 0 THEN
    DBMS_OUTPUT.PUT_LINE('Creating tablespace GOLD_TS...');
    EXECUTE IMMEDIATE q'[
      CREATE TABLESPACE gold_ts
        DATAFILE 'gold_ts.dbf'
        SIZE 100M
        AUTOEXTEND ON NEXT 50M
        SEGMENT SPACE MANAGEMENT AUTO
    ]';
  ELSE
    DBMS_OUTPUT.PUT_LINE('Tablespace GOLD_TS already exists. Skipping.');
  END IF;

  -- ==========================================================================
  -- 2) USERS / SCHEMAS
  -- ==========================================================================

  SELECT COUNT(*) INTO v_cnt FROM dba_users WHERE username = 'RAW_LAYER';
  IF v_cnt = 0 THEN
    DBMS_OUTPUT.PUT_LINE('Creating user RAW_LAYER...');
    EXECUTE IMMEDIATE q'[
      CREATE USER raw_layer IDENTIFIED BY "Raw#123"
        DEFAULT TABLESPACE raw_ts
        QUOTA UNLIMITED ON raw_ts
    ]';
  ELSE
    DBMS_OUTPUT.PUT_LINE('User RAW_LAYER already exists. Skipping.');
  END IF;

  SELECT COUNT(*) INTO v_cnt FROM dba_users WHERE username = 'SILVER_LAYER';
  IF v_cnt = 0 THEN
    DBMS_OUTPUT.PUT_LINE('Creating user SILVER_LAYER...');
    EXECUTE IMMEDIATE q'[
      CREATE USER silver_layer IDENTIFIED BY "Silver#123"
        DEFAULT TABLESPACE silver_ts
        QUOTA UNLIMITED ON silver_ts
    ]';
  ELSE
    DBMS_OUTPUT.PUT_LINE('User SILVER_LAYER already exists. Skipping.');
  END IF;

  SELECT COUNT(*) INTO v_cnt FROM dba_users WHERE username = 'GOLD_LAYER';
  IF v_cnt = 0 THEN
    DBMS_OUTPUT.PUT_LINE('Creating user GOLD_LAYER...');
    EXECUTE IMMEDIATE q'[
      CREATE USER gold_layer IDENTIFIED BY "Gold#123"
        DEFAULT TABLESPACE gold_ts
        QUOTA UNLIMITED ON gold_ts
    ]';
  ELSE
    DBMS_OUTPUT.PUT_LINE('User GOLD_LAYER already exists. Skipping.');
  END IF;

END;
/
-- ============================================================================
-- 3) PRIVILEGES (safe to re-run)
-- ============================================================================

PROMPT == Granting privileges ==

-- Minimal creation privileges for each user + CREATE TRIGGER (needed by RAW/GOLD scripts)
GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SEQUENCE, CREATE PROCEDURE, CREATE TRIGGER TO raw_layer;
GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SEQUENCE, CREATE PROCEDURE, CREATE TRIGGER TO silver_layer;
GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SEQUENCE, CREATE PROCEDURE, CREATE TRIGGER TO gold_layer;

-- Scheduler privileges for GOLD layer (for real-time incremental loads)
GRANT CREATE JOB TO gold_layer;
GRANT MANAGE SCHEDULER TO gold_layer;

-- Cross-layer read (demo-friendly; refine to object-level in production)
GRANT SELECT ANY TABLE TO silver_layer;
GRANT SELECT ANY TABLE TO gold_layer;

PROMPT == Done ==
