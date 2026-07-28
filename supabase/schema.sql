-- 4MP — Sales Management System — Database Schema
-- Run this in the Supabase SQL Editor.

-- AUTH & USERS
CREATE TABLE app_users (
  id                 TEXT PRIMARY KEY,
  email              TEXT UNIQUE NOT NULL,
  name               TEXT NOT NULL,
  role               TEXT NOT NULL DEFAULT 'sales',   -- 'admin'|'sales'|'technician'
  is_active          BOOLEAN NOT NULL DEFAULT true,
  password_hash      TEXT,
  password_salt      TEXT,
  last_login         TIMESTAMPTZ,
  report_permissions TEXT[] NOT NULL DEFAULT '{}',
  sales_person_id    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL, last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT, is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE sales_persons (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE app_users ADD CONSTRAINT app_users_sp_fk
  FOREIGN KEY (sales_person_id) REFERENCES sales_persons(id) ON DELETE SET NULL;

-- MACHINES (products) — physical goods, no inventory
CREATE TABLE machines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,          -- 'לייזר'|'אפילציה'|'IPL'|'פלזמה'|'אומנימקס'
  description TEXT,
  price NUMERIC(12,2),
  image_url TEXT,
  variations JSONB NOT NULL DEFAULT '[]',   -- [{id,name,price_modifier}]
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CUSTOMERS
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'clinic',      -- 'cosmetician'|'doctor'|'clinic'
  contact_name TEXT,
  phone TEXT, email TEXT, city TEXT, address TEXT,
  notes TEXT, lead_id TEXT,
  sharplight_id TEXT UNIQUE,          -- legacy Sharplight customer number (מס' לקוח)
  existing_machines TEXT,             -- known machines/products (מכונה קיימת), newline-separated
  machine_id_number TEXT,             -- most recent device serial (מס' מכשיר)
  machine_shipped_date DATE,          -- most recent shipment date (תאריך משלוח)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LEADS
CREATE TABLE leads (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, city TEXT,
  source TEXT NOT NULL DEFAULT 'direct', status TEXT NOT NULL DEFAULT 'new',
  score INTEGER NOT NULL DEFAULT 0,
  assigned_to TEXT REFERENCES sales_persons(id) ON DELETE SET NULL,
  machines_interested JSONB NOT NULL DEFAULT '[]',
  business_type TEXT,                        -- 'cosmetician'|'doctor'|'clinic'
  client_status TEXT,                        -- 'existing'|'new'
  deal_value NUMERIC(12,2),
  conversation_summary TEXT, follow_up_date DATE, reminders JSONB DEFAULT '[]',
  notes TEXT, origin_url TEXT, old_id TEXT UNIQUE, is_return BOOLEAN DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lead_interactions (
  id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note',   -- 'note'|'call'|'whatsapp'|'email'|'log'
  content TEXT NOT NULL, created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meeting_id TEXT   -- FK added below, once the meetings table exists
);

-- SALES MEETINGS
CREATE TABLE meetings (
  id TEXT PRIMARY KEY,
  lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  sales_person_id TEXT REFERENCES sales_persons(id) ON DELETE SET NULL,
  title TEXT,
  customer_name TEXT, phone TEXT,
  meeting_type TEXT NOT NULL DEFAULT 'in_person',  -- 'in_person'|'video'|'phone'
  scheduled_date DATE, scheduled_time TIME, location TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',         -- 'scheduled'|'completed'|'cancelled'|'no_show'
  outcome TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE lead_interactions ADD CONSTRAINT lead_interactions_meeting_fk
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;

-- SALES
CREATE TABLE sales (
  id TEXT PRIMARY KEY, date DATE NOT NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL, phone TEXT, email TEXT, city TEXT, address TEXT,
  machines JSONB NOT NULL DEFAULT '[]',   -- [{machine_id,variation_id,quantity,name,serial}]
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payments JSONB,                          -- [{type,amount,invoice_link}]
  sales_person TEXT, sales_person_id TEXT REFERENCES sales_persons(id) ON DELETE SET NULL,
  lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
  delivery_type TEXT NOT NULL DEFAULT 'delivery_and_install', -- 'pickup'|'delivery'|'delivery_and_install'
  status TEXT NOT NULL DEFAULT 'new',      -- 'new'|'confirmed'|'paid'|'delivered'|'installed'|'cancelled'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TRAINING
CREATE TABLE training_sessions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  subject     TEXT,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  created_by  TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE training_attendees (
  id             TEXT PRIMARY KEY,
  session_id     TEXT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  lead_id        TEXT REFERENCES leads(id) ON DELETE CASCADE,
  customer_id    TEXT REFERENCES customers(id) ON DELETE CASCADE,
  attendee_name  TEXT NOT NULL,
  attendee_phone TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT training_attendee_one_ref CHECK (
    (lead_id IS NOT NULL AND customer_id IS NULL) OR
    (lead_id IS NULL AND customer_id IS NOT NULL)
  )
);

-- INSTALLATIONS
CREATE TABLE installations (
  id TEXT PRIMARY KEY,
  sale_id TEXT REFERENCES sales(id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL, phone TEXT, city TEXT, address TEXT,
  machine_id TEXT REFERENCES machines(id) ON DELETE SET NULL, machine_name TEXT,
  serial_number TEXT,
  technician_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  planned_date DATE, actual_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'scheduled'|'completed'|'cancelled'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Disable RLS (one statement per table)
ALTER TABLE app_users         DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions          DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales_persons     DISABLE ROW LEVEL SECURITY;
ALTER TABLE machines          DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers         DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads             DISABLE ROW LEVEL SECURITY;
ALTER TABLE lead_interactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE meetings           DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales              DISABLE ROW LEVEL SECURITY;
ALTER TABLE installations      DISABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions  DISABLE ROW LEVEL SECURITY;
ALTER TABLE training_attendees DISABLE ROW LEVEL SECURITY;

GRANT SELECT,INSERT,UPDATE,DELETE ON
  app_users,sessions,sales_persons,machines,customers,leads,lead_interactions,meetings,sales,installations,
  training_sessions,training_attendees
  TO anon,authenticated;

-- Seed machines (names only — adjust prices later)
INSERT INTO machines (id,name,category,price,variations) VALUES
 ('m1','לייזר דיודה','לייזר',45000,'[]'),
 ('m2','אפילציה - מכשיר מקצועי','אפילציה',18000,'[]'),
 ('m3','IPL קליני','IPL',32000,'[]'),
 ('m4','פלזמה','פלזמה',28000,'[]'),
 ('m5','אומנימקס','אומנימקס',60000,'[]');

-- FIRST-RUN: create the first admin user, then set a password via the /users page.
INSERT INTO app_users (id,email,name,role,is_active,created_at)
VALUES ('admin-001','admin@4mp.co.il','מנהל','admin',true,now());
