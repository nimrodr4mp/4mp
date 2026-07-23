-- 4MP — Row Level Security lockdown.
-- Run this in the Supabase SQL Editor AFTER the new auth code is deployed and you
-- can log in. Once applied, the public/anon key can no longer read or write any
-- table — only requests carrying a valid JWT from /api/login are allowed.

-- ── 1) Revoke the wide-open anon grants from the earlier setup ──
REVOKE ALL ON app_users, sessions, sales_persons, machines, machine_categories,
  customers, leads, lead_interactions, meetings, sales, installations,
  training_sessions, training_attendees FROM anon;

-- ── 2) Ensure the authenticated role has table privileges (RLS still governs access) ──
--     app_users gets narrower, column-level grants below (step 5) instead of
--     the blanket grant, so password_hash/password_salt are never readable.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  sales_persons, machines, machine_categories, customers, leads,
  lead_interactions, meetings, sales, installations,
  training_sessions, training_attendees TO authenticated;

-- ── 3) Enable RLS on every table ──
ALTER TABLE app_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_persons     ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales              ENABLE ROW LEVEL SECURITY;
ALTER TABLE installations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_attendees ENABLE ROW LEVEL SECURITY;

-- ── 4) Staff (any authenticated user) may read/write the operational tables ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sales_persons','machines','machine_categories','customers','leads',
    'lead_interactions','meetings','sales','installations',
    'training_sessions','training_attendees'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS staff_all ON %I;', t);
    EXECUTE format(
      'CREATE POLICY staff_all ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true);', t
    );
  END LOOP;
END $$;

-- ── 5) app_users: any staff member may read names/roles; only admins may write.
--     Column-level grants (not a bypass view) keep password_hash/password_salt
--     write-only — the admin "set password" flow can set them, but they can
--     never be read back through the API. /api/login reads them separately via
--     the service_role key, which ignores RLS/grants entirely.
DROP POLICY IF EXISTS admin_all ON app_users;

CREATE POLICY staff_read ON app_users FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_insert ON app_users FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');
CREATE POLICY admin_update ON app_users FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');
CREATE POLICY admin_delete ON app_users FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'admin');

GRANT SELECT (id, email, name, role, is_active, last_login, sales_person_id, report_permissions, created_at)
  ON app_users TO authenticated;
GRANT INSERT (id, email, name, role, is_active, sales_person_id, report_permissions)
  ON app_users TO authenticated;
GRANT UPDATE (email, name, role, is_active, sales_person_id, report_permissions, password_hash, password_salt)
  ON app_users TO authenticated;
GRANT DELETE ON app_users TO authenticated;

-- ── 6) sessions: locked to service_role only (no authenticated policy) ──
--     (the app no longer uses this table; kept for history.)
