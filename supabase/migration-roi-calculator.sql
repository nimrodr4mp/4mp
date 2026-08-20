-- 4MP migration: מחשבון החזר השקעה (ROI) — קטלוג, נרשמים ותרחישים שמורים.
-- הרצה חד־פעמית ב-Supabase SQL Editor.
--
-- ── מודל האבטחה ──
-- המחשבון הוא אתר ציבורי ללא התחברות, ולכן הוא *אינו* ניגש ל-Supabase עם
-- מפתח ה-anon. כל הגישה שלו עוברת דרך פונקציות serverless שמשתמשות
-- ב-service_role בצד השרת (אותו דפוס כמו api/lead-webhook.ts).
-- לכן, בדיוק כמו ב-rls.sql: אין כאן שום GRANT ל-anon. אף לא אחד.
-- הצוות (authenticated) מקבל קריאה בלבד לנתוני הלקוחות, ומנהל בלבד רשאי
-- לערוך את הקטלוג.

-- ─────────────────────────────────────────────────────────────
-- 1) קטלוג: מכשירים והטיפולים שלהם
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roi_devices (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,               -- השם המלא כפי שמוצג בבחירת המכשיר
  short_name  TEXT NOT NULL,               -- שם מקוצר לכותרות ולגרף
  category    TEXT NOT NULL,
  price       NUMERIC(12,2) NOT NULL,      -- מחיר ברירת המחדל של המכשיר
  -- קישור רשות למכשיר בקטלוג ה-CRM. המחיר כאן עצמאי במכוון: מחיר ההצעה
  -- במחשבון יכול להיות שונה ממחיר המחירון, בלי שאחד ידרוס את השני.
  machine_id  TEXT REFERENCES machines(id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roi_treatments (
  id              TEXT PRIMARY KEY,
  device_id       TEXT NOT NULL REFERENCES roi_devices(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  price           NUMERIC(12,2) NOT NULL,   -- מחיר ללקוח
  monthly_clients INTEGER NOT NULL,         -- לקוחות בחודש בתפוסה מלאה
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS roi_treatments_device_idx ON roi_treatments (device_id, sort_order);

-- ─────────────────────────────────────────────────────────────
-- 2) נרשמים למחשבון
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roi_users (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  city         TEXT,
  phone        TEXT NOT NULL,              -- כפי שהוקלד
  phone_norm   TEXT NOT NULL,              -- 0XXXXXXXXX — לזיהוי חוזר ולהצלבה מול לידים
  -- הליד שנוצר ב-CRM מהרישום הזה. SET NULL ולא CASCADE: מחיקת ליד לא
  -- אמורה למחוק את התרחיש ששמר הלקוח.
  lead_id      TEXT REFERENCES leads(id) ON DELETE SET NULL,
  -- אסימון "קישור חזרה". זו יכולת גישה, לא סיסמה: מי שמחזיק בקישור רואה
  -- את התרחיש. הוא נוצר בשרת (crypto.randomBytes) ולעולם לא נגזר מהטלפון.
  resume_token TEXT NOT NULL UNIQUE,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS roi_users_phone_idx   ON roi_users (phone_norm);
CREATE INDEX IF NOT EXISTS roi_users_created_idx ON roi_users (created_at DESC);
CREATE INDEX IF NOT EXISTS roi_users_lead_idx    ON roi_users (lead_id);

-- ─────────────────────────────────────────────────────────────
-- 3) התרחיש השמור
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roi_scenarios (
  id           TEXT PRIMARY KEY,
  -- תרחיש אחד לכל נרשם. אם בעתיד נרצה כמה תרחישים לאותו לקוח — מסירים
  -- את ה-UNIQUE ומוסיפים שם לתרחיש.
  roi_user_id  TEXT NOT NULL UNIQUE REFERENCES roi_users(id) ON DELETE CASCADE,
  device_id    TEXT REFERENCES roi_devices(id) ON DELETE SET NULL,
  device_name  TEXT,                        -- צילום מצב, כדי שמחיקת מכשיר לא תרוקן את הרשימה
  -- מצב המחשבון המלא (מימון, הוצאות, תוכנית שיווק, דריסות מחירים וכמויות).
  -- אותו אובייקט שנשמר היום ב-localStorage תחת roi.state.v1.
  state        JSONB NOT NULL DEFAULT '{}',
  -- ערכים מחושבים, משוכפלים בכוונה כדי שמסך הניהול יציג רשימה בלי לפרסר
  -- JSON ובלי להריץ את מנוע החישוב בשרת. מקור האמת נשאר state.
  monthly_revenue NUMERIC(12,2),
  monthly_profit  NUMERIC(12,2),
  payback_months  INTEGER,                  -- NULL = לא מחזיר בתוך 72 חודשים
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS roi_scenarios_updated_idx ON roi_scenarios (updated_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 4) RLS — נעילה מלאה, בדיוק כמו בשאר הטבלאות התפעוליות
-- ─────────────────────────────────────────────────────────────

-- ביטול מפורש של הרשאות anon, גם אם לא ניתנו מעולם. זה ההבדל בין
-- "לא נתנו" לבין "ודאנו שאין".
REVOKE ALL ON roi_devices, roi_treatments, roi_users, roi_scenarios FROM anon;

ALTER TABLE roi_devices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE roi_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE roi_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE roi_scenarios  ENABLE ROW LEVEL SECURITY;

-- הקטלוג: כל אנשי הצוות רואים, רק מנהל עורך.
GRANT SELECT, INSERT, UPDATE, DELETE ON roi_devices, roi_treatments TO authenticated;

DROP POLICY IF EXISTS staff_read   ON roi_devices;
DROP POLICY IF EXISTS admin_write  ON roi_devices;
CREATE POLICY staff_read  ON roi_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_write ON roi_devices FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');

DROP POLICY IF EXISTS staff_read   ON roi_treatments;
DROP POLICY IF EXISTS admin_write  ON roi_treatments;
CREATE POLICY staff_read  ON roi_treatments FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_write ON roi_treatments FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');

-- נרשמים ותרחישים: הצוות קורא בלבד. כל הכתיבה מגיעה מהמחשבון הציבורי
-- דרך service_role, שמתעלם מ-RLS ממילא — ולכן אין כאן מדיניות כתיבה.
GRANT SELECT ON roi_users, roi_scenarios TO authenticated;

DROP POLICY IF EXISTS staff_read ON roi_users;
DROP POLICY IF EXISTS staff_read ON roi_scenarios;
CREATE POLICY staff_read ON roi_users     FOR SELECT TO authenticated USING (true);
CREATE POLICY staff_read ON roi_scenarios FOR SELECT TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────
-- 5) זרעי הקטלוג — הערכים שהיו עד היום קבועים בקוד (DEFAULT_CATALOG)
-- ─────────────────────────────────────────────────────────────

INSERT INTO roi_devices (id, name, short_name, category, price, sort_order) VALUES
  ('elysion',     'Elysion Pro — הסרת שיער בלייזר',   'Elysion Pro',  'הסרת שיער',     180000, 1),
  ('ultight',     'Ultight — HIFU למיצוק עור',        'Ultight',      'אנטי־אייג׳ינג', 120000, 2),
  ('omnimax',     'Omnimax S3 — פלטפורמה משולבת',     'Omnimax S3',   'רב־יישומי',     220000, 3),
  ('coolshaping', 'Cool Shaping — קריוליפוליזה',      'Cool Shaping', 'עיצוב הגוף',     95000, 4),
  ('plason',      'Plason — פלזמה לטיפולי פנים',      'Plason',       'טיפולי פנים',    45000, 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO roi_treatments (id, device_id, name, price, monthly_clients, sort_order) VALUES
  ('elysion-t1',     'elysion',     'הסרת שיער — גוף מלא (מפגש)',    350, 40, 1),
  ('elysion-t2',     'elysion',     'הסרת שיער — אזור בינוני',        200, 30, 2),
  ('elysion-t3',     'elysion',     'הסרת שיער — אזור קטן',           120, 45, 3),
  ('ultight-t1',     'ultight',     'מיצוק פנים HIFU',                900, 14, 1),
  ('ultight-t2',     'ultight',     'צוואר ומחשוף',                   600, 10, 2),
  ('ultight-t3',     'ultight',     'מיצוק עור בגוף',                 800,  8, 3),
  ('omnimax-t1',     'omnimax',     'פוטו־נעורים IPL',                450, 20, 1),
  ('omnimax-t2',     'omnimax',     'הסרת שיער IPL',                  250, 35, 2),
  ('omnimax-t3',     'omnimax',     'טיפול בנימים ופיגמנטציה',        500, 12, 3),
  ('omnimax-t4',     'omnimax',     'מיצוק עור RF',                   400, 15, 4),
  ('coolshaping-t1', 'coolshaping', 'הקפאת שומן — בטן',               700, 12, 1),
  ('coolshaping-t2', 'coolshaping', 'הקפאת שומן — ירכיים',            600, 14, 2),
  ('coolshaping-t3', 'coolshaping', 'חבילת עיצוב היקפים (4 מפגשים)', 1800,  4, 3),
  ('plason-t1',      'plason',      'טיפול פנים פלזמה',               400, 20, 1),
  ('plason-t2',      'plason',      'טיפול אקנה',                     350, 12, 2),
  ('plason-t3',      'plason',      'חידוש והצערת עור',               500,  8, 3)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 6) בדיקה — אמור להחזיר 5 מכשירים, 16 טיפולים, ואפס הרשאות anon.
--    זו שאילתה אמיתית ולא הערה, במכוון: עורך ה-SQL מפצל את הסקריפט
--    לפי ';', וקטע שמכיל הערות בלבד מחזיר
--    "syntax error at end of input" בשורה 0.
-- ─────────────────────────────────────────────────────────────

SELECT (SELECT count(*) FROM roi_devices)    AS devices,
       (SELECT count(*) FROM roi_treatments) AS treatments,
       (SELECT count(*) FROM information_schema.role_table_grants
         WHERE grantee = 'anon' AND table_name LIKE 'roi%') AS anon_grants;
