-- Adds the "לקוח קיים/לקוח חדש" field to leads. Run once in the Supabase SQL Editor.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_status TEXT;  -- 'existing' | 'new'
