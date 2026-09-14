-- 4MP migration: ליאב עובדת גם במכירות, לא רק בהדרכות.
-- הרצה חד־פעמית ב-Supabase SQL Editor.
--
-- שלושה חלקים:
--   1) רישום ליאב כאיש מכירות, כדי שתופיע בבחירת איש מכירות בלידים/פגישות.
--   2) קישור משתמש ליאב לאותה רשומה, כדי שתראה רק את הלידים שלה.
--   3) הרחבת מדיניות ה-RLS של מחשבון ההחזר לכל לקוח, כי מסך
--      "מחשבון לפי לקוח" נפתח עכשיו גם ל-training_manager. בלי זה המסך
--      ייפתח והשמירה תיכשל.

-- ─────────────────────────────────────────────────────────────
-- 1) ליאב כאיש מכירות
-- ─────────────────────────────────────────────────────────────
INSERT INTO sales_persons (id, name, email, is_active)
VALUES ('sp-liav', 'ליאב', 'liav_e@4mp.co.il', true)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2) קישור המשתמש לרשומת איש המכירות
-- ─────────────────────────────────────────────────────────────
UPDATE app_users
   SET sales_person_id = 'sp-liav'
 WHERE email = 'liav_e@4mp.co.il';

-- ─────────────────────────────────────────────────────────────
-- 3) הרשאת כתיבה למחשבון לפי לקוח גם ל-training_manager
--    (הקטלוג הגלובלי roi_devices/roi_treatments נשאר admin+sales בלבד,
--     כי הוא המחירון הפומבי — ROUTE_ROLES['/roi-catalog'] תואם לכך.)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS staff_write ON roi_user_devices;
CREATE POLICY staff_write ON roi_user_devices FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'app_role') IN ('admin', 'sales', 'training_manager'))
  WITH CHECK ((auth.jwt() ->> 'app_role') IN ('admin', 'sales', 'training_manager'));

DROP POLICY IF EXISTS staff_write ON roi_user_treatments;
CREATE POLICY staff_write ON roi_user_treatments FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'app_role') IN ('admin', 'sales', 'training_manager'))
  WITH CHECK ((auth.jwt() ->> 'app_role') IN ('admin', 'sales', 'training_manager'));

-- ─────────────────────────────────────────────────────────────
-- בדיקה
-- ─────────────────────────────────────────────────────────────
SELECT id, name, email, is_active FROM sales_persons ORDER BY name;

SELECT name, role, sales_person_id FROM app_users ORDER BY name;

SELECT tablename, policyname, cmd
  FROM pg_policies
 WHERE tablename IN ('roi_user_devices', 'roi_user_treatments')
 ORDER BY tablename, policyname;
