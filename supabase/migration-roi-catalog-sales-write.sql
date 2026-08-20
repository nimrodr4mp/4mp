-- 4MP migration: הרשאת עריכה לקטלוג מחשבון ההחזר גם לאנשי מכירות.
-- הרצה חד־פעמית ב-Supabase SQL Editor, אחרי migration-roi-calculator.sql.
--
-- למה: מסך "מחשבון החזר" ב-CRM פתוח ל-admin ול-sales (ראו ROUTE_ROLES), אבל
-- מדיניות ה-RLS המקורית התירה כתיבה ל-admin בלבד. בלי הקובץ הזה איש מכירות
-- יראה את המסך, יערוך — והשמירה תיכשל.
--
-- מה זה אומר בפועל: המחירים והטיפולים כאן מוצגים לכל אדם שנכנס למחשבון
-- הציבורי. הרחבה זו נותנת לאנשי המכירות לשנות מחירון פומבי. אם זה אינו רצוי,
-- אין להריץ את הקובץ — ואז יש לצמצם את ROUTE_ROLES['/roi-catalog'] ל-['admin']
-- בלבד, כדי שלא יוצג מסך שאי אפשר לשמור בו.
--
-- הקריאה (SELECT) לא משתנה: היא ממילא פתוחה לכל אנשי הצוות.

DROP POLICY IF EXISTS admin_write ON roi_devices;
DROP POLICY IF EXISTS admin_write ON roi_treatments;

CREATE POLICY staff_write ON roi_devices FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'app_role') IN ('admin', 'sales'))
  WITH CHECK ((auth.jwt() ->> 'app_role') IN ('admin', 'sales'));

CREATE POLICY staff_write ON roi_treatments FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'app_role') IN ('admin', 'sales'))
  WITH CHECK ((auth.jwt() ->> 'app_role') IN ('admin', 'sales'));

-- בדיקה: אמורות להופיע staff_read ו-staff_write לכל אחת מהטבלאות.
SELECT tablename, policyname, cmd
  FROM pg_policies
 WHERE tablename IN ('roi_devices', 'roi_treatments')
 ORDER BY tablename, policyname;
