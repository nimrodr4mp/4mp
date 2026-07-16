-- 1) "ערך כספי" (deal value) field on leads.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_value NUMERIC(12,2);

-- 2) Denormalized customer name/phone on meetings, so a meeting shows who
--    it's with without a join back to leads/customers (same pattern as
--    sales/installations). Auto-filled from the lead when a meeting is
--    scheduled from the lead modal; editable directly on the Meetings page too.
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS phone TEXT;
