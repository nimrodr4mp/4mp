-- 4MP — one-shot fix: disable RLS, grant access, seed machines, create admin with password.
-- Safe to run on the existing (partially-applied) schema.

-- 1) Disable RLS on all tables
ALTER TABLE app_users         DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions          DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales_persons     DISABLE ROW LEVEL SECURITY;
ALTER TABLE machines          DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers         DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads             DISABLE ROW LEVEL SECURITY;
ALTER TABLE lead_interactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE meetings          DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales             DISABLE ROW LEVEL SECURITY;
ALTER TABLE installations     DISABLE ROW LEVEL SECURITY;

-- 2) Grants for the anon/authenticated roles used by the app
GRANT SELECT,INSERT,UPDATE,DELETE ON
  app_users,sessions,sales_persons,machines,customers,leads,lead_interactions,meetings,sales,installations
  TO anon,authenticated;

-- 3) Seed machine catalog (skip rows that already exist)
INSERT INTO machines (id,name,category,price,variations) VALUES
 ('m1','לייזר דיודה','לייזר',45000,'[]'),
 ('m2','אפילציה - מכשיר מקצועי','אפילציה',18000,'[]'),
 ('m3','IPL קליני','IPL',32000,'[]'),
 ('m4','פלזמה','פלזמה',28000,'[]'),
 ('m5','אומנימקס','אומנימקס',60000,'[]')
ON CONFLICT (id) DO NOTHING;

-- 4) Create/refresh the admin user with password 1qa2ws3ed (PBKDF2-SHA256, 100k iters)
INSERT INTO app_users (id,email,name,role,is_active,password_salt,password_hash,created_at)
VALUES (
  'admin-001','admin@4mp.co.il','מנהל','admin',true,
  'beb8b7ddfd3ba9a47a3de3b5d5ab8c9c1dbb0ec5198ed17055ffcacbd85774a7',
  '2cadbef2214b54d174bd6362a0ff0e80b4df608f3bb833f7071d5ab8c512e8ce',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  password_salt = EXCLUDED.password_salt,
  password_hash = EXCLUDED.password_hash,
  is_active     = true;
