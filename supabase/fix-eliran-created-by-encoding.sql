-- One-off data cleanup: ~130 historic auto-generated lead_interactions rows
-- (the "סטטוס שונה..." / "נקבעה פגישה..." log entries) have a mojibake-corrupted
-- created_by value from before the current login/JWT flow. The interaction
-- content itself was never affected — only this attribution field. Confirmed
-- with the business owner that these all belong to Eliran (אלירן).
--
-- The corrupted values all contain the multiplication-sign character (×),
-- which never appears in legitimate Hebrew text — a safe, tight match for
-- every corrupted variant, not just the two seen during the investigation.

-- 1) Run this first to sanity-check what will be affected:
SELECT id, created_by, content, created_at
FROM lead_interactions
WHERE created_by LIKE '%×%'
ORDER BY created_at;

-- 2) Once the preview above looks right, run the fix:
UPDATE lead_interactions
SET created_by = 'אלירן'
WHERE created_by LIKE '%×%';
