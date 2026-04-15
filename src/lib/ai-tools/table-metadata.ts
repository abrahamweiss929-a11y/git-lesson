/**
 * Static lab-domain metadata for each queryable table.
 * Used by the describe_table tool to give the AI rich context
 * about table structure, common queries, and gotchas.
 *
 * Column descriptions and sample_values_skip are filled in from
 * the actual migration files (migration-001.sql, migration-002-item-v3.sql).
 */

export interface ColumnMeta {
  name: string;
  type: string;
  nullable: boolean;
  description: string;
  skip_sample_values?: boolean; // true for id/timestamp columns
}

export interface TableMeta {
  table_name: string;
  purpose: string;
  columns: ColumnMeta[];
  common_queries: string[];
  gotchas: string[];
  related_tables: string[];
}

export const TABLE_METADATA: Record<string, TableMeta> = {
  item: {
    table_name: "item",
    purpose:
      "Product catalog — every unique product (SKU) the lab uses. Mostly reagents, calibrators, controls, and consumables for chemistry/immunology/hematology testing.",
    columns: [
      { name: "id", type: "bigint", nullable: false, description: "Primary key", skip_sample_values: true },
      { name: "item_code", type: "text", nullable: false, description: "Manufacturer's catalog number (unique, case-insensitive with whitespace trimmed). E.g., 'A98032' for Beckman Access hCG." },
      { name: "item_name", type: "text", nullable: true, description: "Descriptive name, e.g., 'Beckman Access hCG'." },
      { name: "manufacturer", type: "text", nullable: true, description: "Who makes it. Common: 'Beckman Coulter', 'Sysmex', 'Bio-Rad', 'Roche'." },
      { name: "manufacturer_verified", type: "boolean", nullable: false, description: "True if the user confirmed item_code is the real manufacturer code (not a supplier alias)." },
      { name: "parts_per_box", type: "integer", nullable: true, description: "Physical units per package." },
      { name: "tests_per_box", type: "integer", nullable: true, description: "Number of patient tests one box can run (often differs from parts_per_box)." },
      { name: "shelf_life_days", type: "integer", nullable: true, description: "Manufacturer's stated shelf life in days." },
      { name: "test_type", type: "text", nullable: true, description: "Clinical test the item is for. Common: 'Glucose', 'BUN', 'Creatinine', 'hCG', 'TSH', 'Free T4', 'CBC'." },
      { name: "machine", type: "text", nullable: true, description: "Instrument that uses the item. Common: 'DxC 700 AU', 'DxI 800', 'XN-1000', 'Accu-Chek Inform II'." },
      { name: "item_type", type: "text", nullable: true, description: "Kind of supply. Common: 'Reagent', 'Calibrator', 'Control', 'Consumable', 'Diluent'." },
      { name: "category", type: "text", nullable: true, description: "Lab department. Common: 'Chemistry', 'Hematology', 'Immunology', 'Microbiology', 'Point-of-Care'." },
      { name: "storage_requirements", type: "text", nullable: true, description: "Storage conditions. Common: 'Refrigerated (2-8°C)', 'Frozen (-20°C)', 'Room temperature'." },
      { name: "average_order_qty", type: "integer", nullable: true, description: "Typical reorder quantity in boxes." },
      { name: "notes", type: "text", nullable: true, description: "Free-text notes about handling, history, quirks." },
      { name: "created_at", type: "timestamptz", nullable: false, description: "Row creation timestamp", skip_sample_values: true },
      { name: "updated_at", type: "timestamptz", nullable: false, description: "Last update timestamp", skip_sample_values: true },
    ],
    common_queries: [
      "How many items do we have?",
      "List all chemistry items",
      "Items for the DxC 700 AU",
      "Items with missing manufacturer",
      "Items added this month",
      "All reagent types",
    ],
    gotchas: [
      "item_code is unique CASE-INSENSITIVELY with whitespace trimmed. Use LOWER(TRIM(...)) for comparisons.",
      "Only item_code is required — all other fields can be null (placeholder items).",
      "item_code may be a manufacturer code OR a supplier alias depending on manufacturer_verified.",
    ],
    related_tables: ["item_supplier", "receipt_line", "purchase_order_line", "usage"],
  },

  item_supplier: {
    table_name: "item_supplier",
    purpose:
      "Links items to suppliers with price and optional alias code. One row per (item, company) pair. Answers: which suppliers carry this item, at what price, and what do they call it?",
    columns: [
      { name: "id", type: "bigint", nullable: false, description: "Primary key", skip_sample_values: true },
      { name: "item_id", type: "bigint", nullable: false, description: "FK to item.id (ON DELETE RESTRICT)." },
      { name: "company_id", type: "bigint", nullable: false, description: "FK to company.id (ON DELETE RESTRICT)." },
      { name: "their_item_code", type: "text", nullable: true, description: "Supplier's own code for this item. NULL if they use the manufacturer code. E.g., 'MED-A98032' for Medline's alias of item A98032." },
      { name: "price", type: "numeric(12,2)", nullable: true, description: "Unit price per box from this supplier." },
      { name: "currency", type: "text", nullable: false, description: "Currency code. Default 'USD'." },
      { name: "notes", type: "text", nullable: true, description: "Notes about this supplier relationship." },
      { name: "last_price_update", type: "timestamptz", nullable: true, description: "Auto-set by trigger when price changes." },
      { name: "created_at", type: "timestamptz", nullable: false, description: "Row creation timestamp", skip_sample_values: true },
      { name: "updated_at", type: "timestamptz", nullable: false, description: "Last update timestamp", skip_sample_values: true },
    ],
    common_queries: [
      "Which suppliers carry item X?",
      "What does supplier Y call item X? (alias lookup)",
      "Cheapest supplier for item X",
      "Compare prices across suppliers",
    ],
    gotchas: [
      "UNIQUE constraint on (item_id, company_id) — one row per item/supplier pair.",
      "their_item_code is NULL when the supplier uses the manufacturer code.",
      "last_price_update is set by a database trigger, not by application code.",
    ],
    related_tables: ["item", "company"],
  },

  company: {
    table_name: "company",
    purpose:
      "Suppliers and distributors the lab orders from. Includes both manufacturers (Beckman, Roche) and distributors (Medline, Block Scientific, Fisher Scientific).",
    columns: [
      { name: "id", type: "bigint", nullable: false, description: "Primary key", skip_sample_values: true },
      { name: "name", type: "text", nullable: false, description: "Company name (unique)." },
      { name: "created_at", type: "timestamptz", nullable: false, description: "Row creation timestamp", skip_sample_values: true },
    ],
    common_queries: [
      "List all suppliers",
      "Suppliers we order from most",
      "Suppliers we haven't used recently",
    ],
    gotchas: [
      "Only 3 columns — id, name, created_at. No address, phone, or contact info tracked.",
      "name is UNIQUE — no duplicate company names allowed.",
    ],
    related_tables: ["purchase_order", "receipt", "item_supplier"],
  },

  purchase_order: {
    table_name: "purchase_order",
    purpose:
      "Purchase orders sent to suppliers. Header-level info only — line items are in purchase_order_line.",
    columns: [
      { name: "id", type: "bigint", nullable: false, description: "Primary key", skip_sample_values: true },
      { name: "company_id", type: "bigint", nullable: false, description: "FK to company.id — the supplier." },
      { name: "date", type: "date", nullable: false, description: "Order date. Default CURRENT_DATE." },
      { name: "created_at", type: "timestamptz", nullable: false, description: "Row creation timestamp", skip_sample_values: true },
    ],
    common_queries: [
      "Orders this month",
      "Orders by supplier",
      "Most recent order",
      "Total number of orders",
    ],
    gotchas: [
      "Column is 'date' not 'order_date'.",
      "No price column on this table — price is on purchase_order_line.",
      "No status, PO number, or expected delivery date columns.",
    ],
    related_tables: ["purchase_order_line", "company"],
  },

  purchase_order_line: {
    table_name: "purchase_order_line",
    purpose:
      "Line items in a purchase order. Each row is one product line.",
    columns: [
      { name: "id", type: "bigint", nullable: false, description: "Primary key", skip_sample_values: true },
      { name: "purchase_order_id", type: "bigint", nullable: false, description: "FK to purchase_order.id (ON DELETE CASCADE)." },
      { name: "item_number", type: "text", nullable: false, description: "Item code as it appeared on the order document. TEXT with NO FK to item table — may be manufacturer code, supplier alias, or unrecognized code." },
      { name: "quantity_boxes", type: "integer", nullable: false, description: "Number of boxes ordered." },
      { name: "price", type: "numeric(10,2)", nullable: true, description: "UNIT PRICE per box (NOT line total). To compute line total: price * quantity_boxes." },
      { name: "created_at", type: "timestamptz", nullable: false, description: "Row creation timestamp", skip_sample_values: true },
    ],
    common_queries: [
      "What items were on order #X?",
      "Total spent (SUM of price * quantity_boxes)",
      "Most ordered items",
      "Orders for a specific item (use find_orders_for_item tool)",
    ],
    gotchas: [
      "item_number is TEXT with NO foreign key to item. Must use find_item_references for alias-aware lookups.",
      "price is UNIT PRICE per box, NOT line total. Line total = price * quantity_boxes.",
      "Column is 'quantity_boxes' not 'quantity'.",
    ],
    related_tables: ["purchase_order", "item", "item_supplier"],
  },

  receipt: {
    table_name: "receipt",
    purpose:
      "Incoming shipments received from suppliers. Header-level info — line items with lots are in receipt_line.",
    columns: [
      { name: "id", type: "bigint", nullable: false, description: "Primary key", skip_sample_values: true },
      { name: "company_id", type: "bigint", nullable: false, description: "FK to company.id — the supplier." },
      { name: "date", type: "date", nullable: false, description: "Receipt date. Default CURRENT_DATE." },
      { name: "created_at", type: "timestamptz", nullable: false, description: "Row creation timestamp", skip_sample_values: true },
    ],
    common_queries: [
      "Receipts this week",
      "Receipts by supplier",
      "Most recent receipt",
    ],
    gotchas: [
      "Column is 'date' not 'receipt_date'.",
      "No invoice number or PO reference columns.",
    ],
    related_tables: ["receipt_line", "company"],
  },

  receipt_line: {
    table_name: "receipt_line",
    purpose:
      "Line items in a received shipment, including lot tracking. Source of truth for what lots are in the lab.",
    columns: [
      { name: "id", type: "bigint", nullable: false, description: "Primary key", skip_sample_values: true },
      { name: "receipt_id", type: "bigint", nullable: false, description: "FK to receipt.id (ON DELETE CASCADE)." },
      { name: "item_number", type: "text", nullable: false, description: "Item code as it appeared on the receipt/invoice. TEXT with NO FK to item table." },
      { name: "quantity_boxes", type: "integer", nullable: false, description: "Number of boxes received." },
      { name: "lot_number", type: "text", nullable: false, description: "Manufacturing lot/batch number for this line. Required." },
      { name: "expiration_date", type: "date", nullable: true, description: "Expiration date for this lot. NULL if not recorded." },
      { name: "created_at", type: "timestamptz", nullable: false, description: "Row creation timestamp", skip_sample_values: true },
    ],
    common_queries: [
      "Lots expiring soon",
      "Receipts for item X (use find_receipts_for_item tool)",
      "Lot numbers received this month",
    ],
    gotchas: [
      "item_number is TEXT with NO foreign key to item. Must use find_item_references for alias-aware lookups.",
      "lot_number is NOT NULL — always has a value.",
      "Column is 'quantity_boxes' not 'quantity'.",
      "expiration_date can be NULL (not all receipts record it).",
    ],
    related_tables: ["receipt", "item", "item_supplier"],
  },

  usage: {
    table_name: "usage",
    purpose:
      "Records of items being consumed/used in the lab.",
    columns: [
      { name: "id", type: "bigint", nullable: false, description: "Primary key", skip_sample_values: true },
      { name: "item_number", type: "text", nullable: false, description: "Item code. TEXT with NO FK to item table. Same alias gotcha as receipt_line and purchase_order_line." },
      { name: "lot_number", type: "text", nullable: false, description: "Lot number being consumed. Required." },
      { name: "parts_used", type: "integer", nullable: false, description: "Number of parts (NOT boxes) used. Default 1." },
      { name: "date", type: "date", nullable: false, description: "Date of usage. Default CURRENT_DATE." },
      { name: "created_at", type: "timestamptz", nullable: false, description: "Row creation timestamp", skip_sample_values: true },
    ],
    common_queries: [
      "Usage this week",
      "Most-used items",
      "Usage for item X (use find_usage_for_item tool)",
      "Usage by lot number",
    ],
    gotchas: [
      "item_number is TEXT with NO foreign key to item. Must use find_item_references for alias-aware lookups.",
      "Column is 'parts_used' NOT 'quantity'. Tracks individual parts, not boxes.",
      "lot_number is NOT NULL — always has a value.",
      "No company/supplier column — usage is not tied to a supplier.",
    ],
    related_tables: ["item", "item_supplier"],
  },
};
