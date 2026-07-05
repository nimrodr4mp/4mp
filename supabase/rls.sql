-- 4MP — Row Level Security lockdown.
-- Run this in the Supabase SQL Editor AFTER the new auth code is deployed and you
-- can log in. Once applied, the public/anon key can no longer read or write any
-- table — only requests carrying a valid JWT from /api/login are allowed.

-- ── 1) Revoke the wide-open anon grants from the earlier setup ──
REVOKE ALL ON app_users, sessions, sales_persons, machines, machine_categories,
  customers, leads, lead_interactions, meetings, sales, installations FROM anon;

-- ── 2) Ensure the authenticated role has table privileges (RLS still governs access) ──
GRANT SELECT, INSERT, UPDATE, DELETE ON
  app_users, sales_persons, machines, machine_categories, customers, leads,
  lead_interactions, meetings, sales, installations TO authenticated;

-- ── 3) Enable RLS on every table ──
ALTER TABLE app_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_persons     ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales             ENABLE ROW LEVEL SECURITY;
ALTER TABLE installations     ENABLE ROW LEVEL SECURITY;

-- ── 4) Staff (any authenticated user) may read/write the operational tables ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sales_persons','machines','machine_categories','customers','leads',
    'lead_interactions','meetings','sales','installations'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS staff_all ON %I;', t);
    EXECUTE format(
      'CREATE POLICY staff_all ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true);', t
    );
  END LOOP;
END $$;

-- ── 5) app_users: only admins (app_role claim = admin) may read/write ──
DROP POLICY IF EXISTS admin_all ON app_users;
CREATE POLICY admin_all ON app_users FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');

-- ── 6) sessions: locked to service_role only (no authenticated policy) ──
--     (the app no longer uses this table; kept for history.)

-- ── 7) Safe, non-secret view of users for name/role lookups by any staff member ──
--     Excludes password_hash / password_salt. Runs as owner, so it is not blocked
--     by the admin-only RLS on app_users; only harmless columns are exposed.
CREATE OR REPLACE VIEW app_users_public AS
  SELECT id, email, name, role, is_active, last_login, sales_person_id, report_permissions, created_at
  FROM app_users;

GRANT SELECT ON app_users_public TO authenticated;
REVOKE ALL ON app_users_public FROM anon;
