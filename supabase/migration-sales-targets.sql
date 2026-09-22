-- 4MP migration: יעד חודשי לאיש מכירות + דוח "יעד חודשי".
-- הרצה חד־פעמית ב-Supabase SQL Editor.
--
-- הדוח מציג לכל איש מכירות: היעד הכספי לחודש, הפוטנציאל מהלידים הפתוחים
-- שלו ואת המכירות בפועל — כל אחד כאחוז מהיעד. המנהל קובע את היעד; איש
-- המכירות רואה אותו בלבד (ההרשאה עצמה ניתנת ב"משתמשים" → הרשאות לדוחות,
-- report_permissions = 'monthly_target').

-- ─────────────────────────────────────────────────────────────
-- 1) טבלת היעדים — שורה אחת לכל (איש מכירות, חודש)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_targets (
  id              TEXT PRIMARY KEY,
  sales_person_id TEXT NOT NULL REFERENCES sales_persons(id) ON DELETE CASCADE,
  -- 'YYYY-MM'. חודש ולא תאריך: היעד שייך לחודש שלם.
  month           TEXT NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  target_amount   NUMERIC NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- מאפשר upsert לפי (איש מכירות, חודש) מהדוח עצמו.
  UNIQUE (sales_person_id, month)
);

CREATE INDEX IF NOT EXISTS sales_targets_month_idx ON sales_targets (month);

-- ─────────────────────────────────────────────────────────────
-- 2) הרשאות ו-RLS
--    קריאה לכל אנשי הצוות המחוברים, כתיבה למנהל בלבד — "המנהל קובע".
--    הסינון ל"רק שלי" נעשה באפליקציה (ownSalesPersonId), בדיוק כמו
--    בלידים ובפגישות, ולכן מדיניות הקריאה כאן היא USING (true).
-- ─────────────────────────────────────────────────────────────
REVOKE ALL ON sales_targets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_targets TO authenticated;

ALTER TABLE sales_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_read   ON sales_targets;
DROP POLICY IF EXISTS admin_write  ON sales_targets;

CREATE POLICY staff_read ON sales_targets FOR SELECT TO authenticated USING (true);

CREATE POLICY admin_write ON sales_targets FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');

-- ─────────────────────────────────────────────────────────────
-- 3) בדיקה
-- ─────────────────────────────────────────────────────────────
SELECT id, sales_person_id, month, target_amount FROM sales_targets ORDER BY month DESC;

SELECT tablename, policyname, cmd
  FROM pg_policies
 WHERE tablename = 'sales_targets'
 ORDER BY policyname;
