-- New customer fields for the legacy Sharplight device-history import.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sharplight_id TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS existing_machines TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS machine_id_number TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS machine_shipped_date DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'customers_sharplight_id_key'
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT customers_sharplight_id_key UNIQUE (sharplight_id);
  END IF;
END $$;
