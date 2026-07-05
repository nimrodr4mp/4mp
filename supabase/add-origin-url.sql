-- Adds the origin_url field to leads (referral source URL from the Excel import).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS origin_url TEXT;
