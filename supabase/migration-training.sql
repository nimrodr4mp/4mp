-- Training section: sessions run for cosmeticians (leads/customers), owned
-- by the new 'training_manager' role. Run this against an already-deployed
-- DB instead of re-running the full schema.sql.

CREATE TABLE IF NOT EXISTS training_sessions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  subject     TEXT,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  created_by  TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_attendees (
  id             TEXT PRIMARY KEY,
  session_id     TEXT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  lead_id        TEXT REFERENCES leads(id) ON DELETE CASCADE,
  customer_id    TEXT REFERENCES customers(id) ON DELETE CASCADE,
  attendee_name  TEXT NOT NULL,
  attendee_phone TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT training_attendee_one_ref CHECK (
    (lead_id IS NOT NULL AND customer_id IS NULL) OR
    (lead_id IS NULL AND customer_id IS NOT NULL)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON training_sessions, training_attendees TO anon, authenticated;

-- If RLS is already enabled on this project (rls.sql has been run), also
-- re-run rls.sql — it now includes these two tables in every grant/policy
-- list so staff can read/write them like the rest of the operational tables.
