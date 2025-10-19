-- ============================================================================
-- Oracle Medallion Setup Script (RAW / SILVER / GOLD)
-- Project: Car-Rental BI Platform
-- Author: Your Team
-- Date: 2025-10-18
-- Target: Oracle Database 21c XE (Pluggable DB: XEPDB1)
--
-- PURPOSE
--   Provision three logical "databases" for a Medallion architecture by creating
--   three Oracle users (schemas) with dedicated tablespaces:
--     - RAW   : raw_layer
--     - SILVER: silver_layer
--     - GOLD  : gold_layer
--
-- USAGE
--   1) Connect as SYSTEM to XEPDB1 (adjust password/host as needed):
--        sqlplus system/Admin#123@localhost:1521/XEPDB1
--
--   2) Run this script in SQL*Plus (as SYSTEM):
--        @oracle_medallion_setup.sql
--
--   3) (Optional) Test connections from your host:
--        docker exec -it oracle-xe sqlplus raw_layer/Raw#123@localhost:1521/XEPDB1
--        docker exec -it oracle-xe sqlplus silver_layer/Silver#123@localhost:1521/XEPDB1
--        docker exec -it oracle-xe sqlplus gold_layer/Gold#123@localhost:1521/XEPDB1
--
-- NOTES
--   - Passwords are placeholders; CHANGE THEM for production use.
--   - Tablespace sizes auto-extend; tune sizes/paths per your storage policy.
--   - Cross-layer privileges below are intentionally broad for demo convenience.
--     Replace with object-level GRANTs in production.
--
-- COMPATIBILITY
--   - Tested on Oracle 21c XE. Adjust DATAFILE paths if you use a different edition.
-- ============================================================================

SET SERVEROUTPUT ON
WHENEVER SQLERROR EXIT SQL.SQLCODE


SHOW CON_NAME;
-- If not XEPDB1, uncomment the following line:
-- ALTER SESSION SET CONTAINER = XEPDB1;

-- ============================================================================
-- 1) TABLESPACES (Optional but recommended for isolation)
-- ============================================================================

CREATE TABLESPACE raw_ts
  DATAFILE 'raw_ts.dbf'
  SIZE 100M
  AUTOEXTEND ON NEXT 50M
  SEGMENT SPACE MANAGEMENT AUTO;

CREATE TABLESPACE silver_ts
  DATAFILE 'silver_ts.dbf'
  SIZE 100M
  AUTOEXTEND ON NEXT 50M
  SEGMENT SPACE MANAGEMENT AUTO;

CREATE TABLESPACE gold_ts
  DATAFILE 'gold_ts.dbf'
  SIZE 100M
  AUTOEXTEND ON NEXT 50M
  SEGMENT SPACE MANAGEMENT AUTO;

-- ============================================================================
-- 2) USERS / SCHEMAS
-- ============================================================================

-- RAW layer user (logical "database": raw)
CREATE USER raw_layer IDENTIFIED BY "Raw#123"
  DEFAULT TABLESPACE raw_ts
  QUOTA UNLIMITED ON raw_ts;

-- SILVER layer user (logical "database": silver)
CREATE USER silver_layer IDENTIFIED BY "Silver#123"
  DEFAULT TABLESPACE silver_ts
  QUOTA UNLIMITED ON silver_ts;

-- GOLD layer user (logical "database": gold)
CREATE USER gold_layer IDENTIFIED BY "Gold#123"
  DEFAULT TABLESPACE gold_ts
  QUOTA UNLIMITED ON gold_ts;

-- ============================================================================
-- 3) PRIVILEGES
-- ============================================================================


-- Minimal creation privileges for each user + CREATE TRIGGER (needed by RAW/GOLD scripts)
GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SEQUENCE, CREATE PROCEDURE, CREATE TRIGGER TO raw_layer;
GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SEQUENCE, CREATE PROCEDURE, CREATE TRIGGER TO silver_layer;
GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SEQUENCE, CREATE PROCEDURE, CREATE TRIGGER TO gold_layer;

-- Cross-layer read (demo-friendly; refine to object-level in production)
GRANT SELECT ANY TABLE TO silver_layer;
GRANT SELECT ANY TABLE TO gold_layer;

