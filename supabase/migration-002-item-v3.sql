-- v3 Item Master Redesign Migration
-- Run in the Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
--
-- Creates new `item` and `item_supplier` tables, migrates data from
-- `item_master` and `supplier_code`, then renames old tables to backups.
-- Wrapped in a transaction so partial failures roll back cleanly.

BEGIN;

-- Step 1: Create item table (replaces item_master)
CREATE TABLE item (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_code             TEXT NOT NULL,
  item_name             TEXT,
  manufacturer          TEXT,
  manufacturer_verified BOOLEAN NOT NULL DEFAULT false,
  parts_per_box         INTEGER,
  tests_per_box         INTEGER,
  shelf_life_days       INTEGER,
  test_type             TEXT,
  machine               TEXT,
  item_type             TEXT,
  category              TEXT,
  storage_requirements  TEXT,
  average_order_qty     INTEGER,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX item_code_unique ON item (LOWER(TRIM(item_code)));

-- Step 2: Create item_supplier table (replaces supplier_code)
CREATE TABLE item_supplier (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id           BIGINT NOT NULL REFERENCES item(id) ON DELETE RESTRICT,
  company_id        BIGINT NOT NULL REFERENCES company(id) ON DELETE RESTRICT,
  their_item_code   TEXT,
  price             NUMERIC(12,2),
  currency          TEXT NOT NULL DEFAULT 'USD',
  notes             TEXT,
  last_price_update TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_id, company_id)
);

-- Step 3: Migrate data from old tables to new tables
-- item_master.internal_name → item.item_code
-- item_master.default_shelf_life → item.shelf_life_days
INSERT INTO item (item_code, parts_per_box, tests_per_box, shelf_life_days, created_at)
SELECT internal_name, parts_per_box, tests_per_box, default_shelf_life, created_at
FROM item_master;

-- supplier_code → item_supplier (join through item_master to map IDs)
INSERT INTO item_supplier (item_id, company_id, their_item_code, created_at)
SELECT i.id, sc.company_id, sc.their_item_number, sc.created_at
FROM supplier_code sc
JOIN item_master im ON im.id = sc.item_master_id
JOIN item i ON LOWER(TRIM(i.item_code)) = LOWER(TRIM(im.internal_name));

-- Step 4: Rename old tables to backups (keep for 30 days, don't drop)
ALTER TABLE item_master RENAME TO item_master_v1_backup;
ALTER TABLE supplier_code RENAME TO supplier_code_v1_backup;

-- Step 5: Enable RLS with permissive policies (no auth in v1)
ALTER TABLE item ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_supplier ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON item FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON item_supplier FOR ALL USING (true) WITH CHECK (true);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER item_updated_at BEFORE UPDATE ON item
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER item_supplier_updated_at BEFORE UPDATE ON item_supplier
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Step 6: Auto-set last_price_update when price actually changes
CREATE OR REPLACE FUNCTION set_last_price_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.price IS DISTINCT FROM OLD.price AND NEW.price IS NOT NULL THEN
    NEW.last_price_update = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER item_supplier_price_changed BEFORE UPDATE ON item_supplier
  FOR EACH ROW EXECUTE FUNCTION set_last_price_update();

-- Step 7: Sanity-check row counts (visible in Supabase SQL Editor output)
DO $$
DECLARE
  v_item_count       BIGINT;
  v_backup_count     BIGINT;
  v_supplier_count   BIGINT;
  v_sup_backup_count BIGINT;
BEGIN
  SELECT count(*) INTO v_backup_count FROM item_master_v1_backup;
  SELECT count(*) INTO v_item_count FROM item;
  SELECT count(*) INTO v_sup_backup_count FROM supplier_code_v1_backup;
  SELECT count(*) INTO v_supplier_count FROM item_supplier;
  RAISE NOTICE 'BEFORE: item_master had % rows, supplier_code had % rows', v_backup_count, v_sup_backup_count;
  RAISE NOTICE 'AFTER:  item has % rows, item_supplier has % rows', v_item_count, v_supplier_count;
  RAISE NOTICE 'EXPECTED: item count should equal item_master count; item_supplier count should equal supplier_code count';
END $$;

COMMIT;
