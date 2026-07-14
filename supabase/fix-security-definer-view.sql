-- Fixes Supabase's "Security Definer View" lint finding on app_users_public.
-- Replaces the view (which implicitly bypassed RLS via its owner's permissions)
-- with native RLS + column-level grants: any authenticated user can read
-- non-secret columns of every user; only admins can write; password_hash /
-- password_salt are never readable through the API (write-only, for the
-- admin "set password" flow), and are used directly only by /api/login via
-- the service_role key, which is unaffected by any of this.
--
-- Run once in the Supabase SQL Editor.

DROP VIEW IF EXISTS app_users_public;
DROP POLICY IF EXISTS admin_all ON app_users;

-- Row-level: any authenticated (logged-in) user may see every user's row.
CREATE POLICY staff_read ON app_users FOR SELECT TO authenticated USING (true);

-- Row-level: only admins may create, edit, or delete users.
CREATE POLICY admin_insert ON app_users FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');
CREATE POLICY admin_update ON app_users FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');
CREATE POLICY admin_delete ON app_users FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'admin');

-- Column-level grants (narrower than the earlier blanket GRANT from rls.sql).
REVOKE ALL ON app_users FROM authenticated;

GRANT SELECT (id, email, name, role, is_active, last_login, sales_person_id, report_permissions, created_at)
  ON app_users TO authenticated;

GRANT INSERT (id, email, name, role, is_active, sales_person_id, report_permissions)
  ON app_users TO authenticated;

-- UPDATE includes password_hash/password_salt so the admin "set password" flow
-- can WRITE them — but SELECT above deliberately excludes those two columns,
-- so they can never be read back through the API.
GRANT UPDATE (email, name, role, is_active, sales_person_id, report_permissions, password_hash, password_salt)
  ON app_users TO authenticated;

GRANT DELETE ON app_users TO authenticated;
