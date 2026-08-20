-- 4MP migration: התאמת קטלוג מחשבון ההחזר ללקוח מסוים.
-- הרצה חד־פעמית ב-Supabase SQL Editor, אחרי migration-roi-calculator.sql.
--
-- ── העיקרון: ברירת מחדל לכולם, חריגה לפי לקוח ──
-- לקוח *ללא* שורות בטבלאות האלה רואה בדיוק את מה שרואה היום — כל המכשירים
-- הפעילים מ-roi_devices והטיפולים שלהם. שום דבר לא משתנה עבור מי שכבר נרשם.
-- ברגע שנוספת ולו שורה אחת ב-roi_user_devices, הלקוח רואה אך ורק את
-- המכשירים שנבחרו לו.
--
-- מחיר/כמות שהם NULL פירושם "לרשת מהקטלוג" — כך עדכון מחיר גלובלי ממשיך
-- לזרום לכל מי שלא נקבע לו מחיר משלו, ורק חריגה מפורשת נשארת קבועה.

-- ─────────────────────────────────────────────────────────────
-- 1) אילו מכשירים הלקוח רואה, ובאיזה מחיר
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roi_user_devices (
  roi_user_id TEXT NOT NULL REFERENCES roi_users(id)   ON DELETE CASCADE,
  device_id   TEXT NOT NULL REFERENCES roi_devices(id) ON DELETE CASCADE,
  price       NUMERIC(12,2),          -- NULL = מחיר הקטלוג
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (roi_user_id, device_id)
);
CREATE INDEX IF NOT EXISTS roi_user_devices_user_idx ON roi_user_devices (roi_user_id, sort_order);

-- ─────────────────────────────────────────────────────────────
-- 2) התאמות ברמת הטיפול הבודד
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roi_user_treatments (
  roi_user_id     TEXT NOT NULL REFERENCES roi_users(id)      ON DELETE CASCADE,
  treatment_id    TEXT NOT NULL REFERENCES roi_treatments(id) ON DELETE CASCADE,
  price           NUMERIC(12,2),       -- NULL = מחיר הקטלוג
  monthly_clients INTEGER,             -- NULL = כמות הקטלוג
  -- הסתרה, ולא מחיקה: הטיפול נשאר בקטלוג הגלובלי וממשיך להופיע לכל השאר.
  is_hidden       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (roi_user_id, treatment_id)
);
CREATE INDEX IF NOT EXISTS roi_user_treatments_user_idx ON roi_user_treatments (roi_user_id);

-- ─────────────────────────────────────────────────────────────
-- 3) RLS — כמו בשאר טבלאות ה-roi: אפס גישה ל-anon
-- ─────────────────────────────────────────────────────────────
-- המחשבון הציבורי קורא את ההתאמות דרך /api/roi-catalog בלבד, שם
-- ה-service_role עוקף RLS. אין כאן שום הרשאת anon.

REVOKE ALL ON roi_user_devices, roi_user_treatments FROM anon;

ALTER TABLE roi_user_devices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE roi_user_treatments ENABLE ROW LEVEL SECURITY;

-- התאמה ללקוח היא עבודת מכירות שוטפת, ולכן גם איש מכירות רשאי לערוך אותה.
-- שימו לב שזו החלטה רחבה יותר מהקטלוג הגלובלי: כאן השינוי נוגע ללקוח אחד
-- בלבד, ולא למחירון שכל הגולשים רואים.
GRANT SELECT, INSERT, UPDATE, DELETE ON roi_user_devices, roi_user_treatments TO authenticated;

DROP POLICY IF EXISTS staff_read  ON roi_user_devices;
DROP POLICY IF EXISTS staff_write ON roi_user_devices;
CREATE POLICY staff_read  ON roi_user_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY staff_write ON roi_user_devices FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'app_role') IN ('admin', 'sales'))
  WITH CHECK ((auth.jwt() ->> 'app_role') IN ('admin', 'sales'));

DROP POLICY IF EXISTS staff_read  ON roi_user_treatments;
DROP POLICY IF EXISTS staff_write ON roi_user_treatments;
CREATE POLICY staff_read  ON roi_user_treatments FOR SELECT TO authenticated USING (true);
CREATE POLICY staff_write ON roi_user_treatments FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'app_role') IN ('admin', 'sales'))
  WITH CHECK ((auth.jwt() ->> 'app_role') IN ('admin', 'sales'));

-- ─────────────────────────────────────────────────────────────
-- 4) בדיקה — שתי הטבלאות קיימות, ריקות, ובלי הרשאות anon
-- ─────────────────────────────────────────────────────────────

SELECT (SELECT count(*) FROM roi_user_devices)    AS user_devices,
       (SELECT count(*) FROM roi_user_treatments) AS user_treatments,
       (SELECT count(*) FROM information_schema.role_table_grants
         WHERE grantee = 'anon' AND table_name LIKE 'roi_user_%') AS anon_grants;
