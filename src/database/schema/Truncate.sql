-- ======================================================================
-- TRUNCATE-ONLY RESET for RAW_LAYER (keeps structure)
-- Empties tables in FK-safe order and resets identity sequences to 1
-- ======================================================================

WHENEVER SQLERROR CONTINUE
SET DEFINE OFF
SET SERVEROUTPUT ON SIZE UNLIMITED

ALTER SESSION SET CURRENT_SCHEMA = RAW_LAYER;

DECLARE
  PROCEDURE try_truncate(p_table IN VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE 'TRUNCATE TABLE '||p_table;
    DBMS_OUTPUT.PUT_LINE('🧹 TRUNCATE '||p_table);
  EXCEPTION
    WHEN OTHERS THEN
      DBMS_OUTPUT.PUT_LINE('⚠ TRUNCATE failed for '||p_table||' → '||SQLERRM||' ; falling back to DELETE');
      EXECUTE IMMEDIATE 'DELETE FROM '||p_table;
      DBMS_OUTPUT.PUT_LINE('🧽 DELETE '||p_table||' (cascade via FK ON DELETE or child-first order)');
  END;

  PROCEDURE reset_identity_sequences IS
    -- 12.2+: ALTER SEQUENCE ... RESTART works; for older, do "increment trick"
    CURSOR c_seq IS
      SELECT sequence_name
      FROM   user_tab_identity_cols
      WHERE  sequence_name IS NOT NULL
      UNION
      SELECT sequence_name
      FROM   user_sequences
      WHERE  sequence_name LIKE 'ISEQ$$_%'; -- identity sequences fallback
    v_last NUMBER;
  BEGIN
    FOR r IN c_seq LOOP
      BEGIN
        EXECUTE IMMEDIATE 'ALTER SEQUENCE '||r.sequence_name||' RESTART START WITH 1';
        DBMS_OUTPUT.PUT_LINE('🔁 RESET '||r.sequence_name||' → 1 (RESTART)');
      EXCEPTION
        WHEN OTHERS THEN
          BEGIN
            SELECT last_number INTO v_last FROM user_sequences WHERE sequence_name = r.sequence_name;
            EXECUTE IMMEDIATE 'ALTER SEQUENCE '||r.sequence_name||' INCREMENT BY '||(1 - v_last);
            EXECUTE IMMEDIATE 'SELECT '||r.sequence_name||'.NEXTVAL FROM dual';
            EXECUTE IMMEDIATE 'ALTER SEQUENCE '||r.sequence_name||' INCREMENT BY 1';
            DBMS_OUTPUT.PUT_LINE('🔁 RESET '||r.sequence_name||' → 1 (increment trick)');
          EXCEPTION WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('⚠ Could not reset '||r.sequence_name||' → '||SQLERRM);
          END;
      END;
    END LOOP;
  END;
BEGIN
  -- Child → Parent order (TRUNCATE has no CASCADE in Oracle)
  try_truncate('RENTALS');
  try_truncate('IOT_ALERTS');
  try_truncate('MANAGERS');        -- child of BRANCHES
  try_truncate('CARS');            -- child of BRANCHES, CAR_CATEGORIES, IOT_DEVICES
  try_truncate('IOT_DEVICES');
  try_truncate('CAR_CATEGORIES');
  try_truncate('CUSTOMERS');
  try_truncate('BRANCHES');

  reset_identity_sequences;
END;
/
COMMIT;
