-- ======================================================================
-- run_all.sql — GOLD layer orchestration
-- ======================================================================
WHENEVER SQLERROR CONTINUE
SET DEFINE OFF

@@0_setup.sql
@@1_drop.sql
@@2_dims.sql
@@3_facts.sql
@@4_pkg_load.sql
@@5_views_gold.sql
@@6_views_kpi.sql

PROMPT [OK] GOLD layer fully deployed
