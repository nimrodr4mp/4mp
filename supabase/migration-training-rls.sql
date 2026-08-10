-- The training tables were created by migration-training.sql, which granted
-- access to `anon` and never enabled RLS — so they are the only tables in the
-- project not locked down like the rest. This brings them in line with
-- leads/meetings/customers (see rls.sql step 4).
--
-- Run this in the Supabase SQL Editor.

-- ── DIAGNOSTIC: run this first and check the output ──
--   rls_enabled=false + no policy rows  -> RLS was not the cause of the save failure
--   rls_enabled=true  + no policy rows  -> THIS was the cause (inserts silently rejected)
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname IN ('training_sessions', 'training_attendees');

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('training_sessions', 'training_attendees');

-- ── FIX: match how every other operational table is secured ──
REVOKE ALL ON training_sessions, training_attendees FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON training_sessions, training_attendees TO authenticated;

ALTER TABLE training_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_all ON training_sessions;
CREATE POLICY staff_all ON training_sessions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS staff_all ON training_attendees;
CREATE POLICY staff_all ON training_attendees FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Verify: both should now show rls_enabled=true with a staff_all policy.
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname IN ('training_sessions', 'training_attendees');
