-- Money value carried on a meeting, so the expected deal size shows on the
-- meeting itself (and is carried over from the lead when a meeting is
-- scheduled from the lead modal).
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS deal_value NUMERIC(12,2);
