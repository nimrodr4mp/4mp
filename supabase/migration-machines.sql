-- 4MP migration: managed machine categories + multi-category / multi-price machines.
-- Run once in the Supabase SQL Editor.

-- 1) Managed category list (edited from the admin Settings screen)
CREATE TABLE IF NOT EXISTS machine_categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT 'gray',   -- palette key: blue|pink|purple|amber|teal|gray
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE machine_categories DISABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON machine_categories TO anon,authenticated;

INSERT INTO machine_categories (id,name,color,sort_order) VALUES
  ('mc1','לייזר','blue',1),
  ('mc2','אפילציה','pink',2),
  ('mc3','IPL','purple',3),
  ('mc4','פלזמה','amber',4),
  ('mc5','אומנימקס','teal',5)
ON CONFLICT (name) DO NOTHING;

-- 2) Multi-category + multi-price columns on machines
ALTER TABLE machines ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE machines ADD COLUMN IF NOT EXISTS prices JSONB NOT NULL DEFAULT '[]';

-- 3) Migrate existing single category -> categories[], single price -> one price option
UPDATE machines
   SET categories = ARRAY[category]
 WHERE category IS NOT NULL
   AND (categories = '{}' OR categories IS NULL);

UPDATE machines
   SET prices = jsonb_build_array(
         jsonb_build_object('id', gen_random_uuid()::text, 'name', 'מחיר בסיס', 'amount', price)
       )
 WHERE price IS NOT NULL
   AND (prices = '[]'::jsonb OR prices IS NULL);
