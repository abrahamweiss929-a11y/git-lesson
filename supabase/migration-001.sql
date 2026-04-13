-- Lab Inventory App: Initial Schema
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- 1. Company (reference data, ~20 entries)
CREATE TABLE company (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Purchase Order header
CREATE TABLE purchase_order (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES company(id),
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Purchase Order lines
CREATE TABLE purchase_order_line (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  purchase_order_id BIGINT NOT NULL REFERENCES purchase_order(id) ON DELETE CASCADE,
  item_number       TEXT NOT NULL,
  quantity_boxes    INTEGER NOT NULL,
  price             NUMERIC(10,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Receipt header
CREATE TABLE receipt (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES company(id),
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Receipt lines
CREATE TABLE receipt_line (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_id      BIGINT NOT NULL REFERENCES receipt(id) ON DELETE CASCADE,
  item_number     TEXT NOT NULL,
  quantity_boxes  INTEGER NOT NULL,
  lot_number      TEXT NOT NULL,
  expiration_date DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Usage (single entries, no header/lines)
CREATE TABLE usage (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_number TEXT NOT NULL,
  lot_number  TEXT NOT NULL,
  parts_used  INTEGER NOT NULL DEFAULT 1,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Item Master (optional reference)
CREATE TABLE item_master (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  internal_name      TEXT NOT NULL,
  parts_per_box      INTEGER,
  tests_per_box      INTEGER,
  default_shelf_life INTEGER, -- in days
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Supplier codes (maps company + their_item_number to an item_master)
CREATE TABLE supplier_code (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_master_id    BIGINT NOT NULL REFERENCES item_master(id) ON DELETE CASCADE,
  company_id        BIGINT NOT NULL REFERENCES company(id),
  their_item_number TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, their_item_number)
);

-- Enable RLS with permissive policies (no auth in v1)
ALTER TABLE company ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_code ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON company FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON purchase_order FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON purchase_order_line FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON receipt FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON receipt_line FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON usage FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON item_master FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON supplier_code FOR ALL USING (true) WITH CHECK (true);
