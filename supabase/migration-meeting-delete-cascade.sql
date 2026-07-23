-- Lets a meeting be deleted from the Meetings page and have the matching
-- "נקבעה פגישה" log entry on the lead disappear with it, instead of leaving
-- a dangling note behind.
ALTER TABLE lead_interactions ADD COLUMN IF NOT EXISTS meeting_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'lead_interactions_meeting_fk'
  ) THEN
    ALTER TABLE lead_interactions ADD CONSTRAINT lead_interactions_meeting_fk
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
  END IF;
END $$;
