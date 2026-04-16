/**
 * Schema description for the AI assistant system prompt.
 * This is the single most important piece — it teaches the AI
 * what data exists, what columns are named, and common pitfalls.
 *
 * ACTUAL column names verified from migration-001.sql and
 * migration-002-item-v3.sql.
 */

export const SCHEMA_DESCRIPTION = `
DATABASE SCHEMA — CLINICAL LAB INVENTORY

You have read access to a Postgres database that tracks the inventory of a
clinical laboratory. Below is a guided tour of the data, including not just
column names but what they mean, typical values, and common pitfalls.

═══════════════════════════════════════════════════════════════════════
TABLE: item — The product catalog
═══════════════════════════════════════════════════════════════════════

Each row represents a unique product (a SKU) the lab uses. Most are reagents
for chemistry/immunology/hematology testing, but also includes calibrators,
controls, consumables, and quality control materials.

Columns:
- id (bigint, PK)
- item_code (text, REQUIRED, unique case-insensitive)
    The product's identifier. Usually the manufacturer's catalog number
    (e.g., "A98032" for Beckman Access hCG, "66300" for Beckman AU Glucose).
- item_name (text, optional) — descriptive name (e.g., "Beckman Access hCG")
- manufacturer (text, optional) — who makes it (e.g., "Beckman Coulter",
    "Sysmex", "Bio-Rad", "Roche")
- manufacturer_verified (boolean, default false)
    True if the user confirmed the item_code is the manufacturer's code.
- parts_per_box (integer, optional) — physical units per package
- tests_per_box (integer, optional) — patient tests one box can run
- shelf_life_days (integer, optional) — manufacturer's shelf life in days
- test_type (text, optional) — clinical test. Common: "Glucose", "BUN",
    "Creatinine", "hCG", "TSH", "Free T4", "CBC"
- machine (text, optional) — instrument. Common: "DxC 700 AU", "DxI 800",
    "XN-1000", "Accu-Chek Inform II"
- item_type (text, optional) — supply kind. Common: "Reagent", "Calibrator",
    "Control", "Consumable", "Diluent"
- category (text, optional) — lab department. Common: "Chemistry",
    "Hematology", "Immunology", "Microbiology", "Point-of-Care"
- storage_requirements (text, optional) — "Refrigerated (2-8°C)",
    "Frozen (-20°C)", "Room temperature"
- average_order_qty (integer, optional)
- notes (text, optional)
- created_at, updated_at (timestamps)

UNIQUE CONSTRAINT: item_code is unique CASE-INSENSITIVELY with trimmed whitespace.

═══════════════════════════════════════════════════════════════════════
TABLE: company — Suppliers and distributors
═══════════════════════════════════════════════════════════════════════

Companies the lab orders from. Minimal table.

Columns:
- id (bigint, PK)
- name (text, NOT NULL, UNIQUE)
- created_at (timestamptz)

Only 3 columns. No address, phone, or contact info.

═══════════════════════════════════════════════════════════════════════
TABLE: item_supplier — Items linked to suppliers (prices and aliases)
═══════════════════════════════════════════════════════════════════════

One row per (item, company) pair. Answers:
  1. Which suppliers carry this item, and at what price?
  2. What does each supplier call this item (their alias code)?

Columns:
- id (bigint, PK)
- item_id (bigint, FK to item.id, ON DELETE RESTRICT)
- company_id (bigint, FK to company.id, ON DELETE RESTRICT)
- their_item_code (text, optional)
    Supplier's own code for this item. NULL if they use the manufacturer code.
    EXAMPLE: Item A98032 might have: (Block Scientific, NULL, $45),
    (Medline, "MED-A98032", $48), (Fisher, NULL, $42)
- price (numeric(12,2), optional) — unit price per box
- currency (text, default 'USD')
- notes (text, optional)
- last_price_update (timestamptz) — auto-set by trigger when price changes
- created_at, updated_at (timestamps)

UNIQUE CONSTRAINT: (item_id, company_id).

═══════════════════════════════════════════════════════════════════════
TABLE: purchase_order — Orders placed with suppliers
═══════════════════════════════════════════════════════════════════════

A purchase order sent to a supplier. Header-level only.

Columns:
- id (bigint, PK)
- company_id (bigint, FK to company.id)
- date (DATE, not "order_date") — default CURRENT_DATE
- created_at (timestamptz)

NOTE: No price column here. No status, PO number, or expected delivery date.

═══════════════════════════════════════════════════════════════════════
TABLE: purchase_order_line — Line items in an order
═══════════════════════════════════════════════════════════════════════

Columns:
- id (bigint, PK)
- purchase_order_id (bigint, FK to purchase_order.id, ON DELETE CASCADE)
- item_number (TEXT, NOT NULL, NO FK to item)
- quantity_boxes (INTEGER, NOT NULL) — column is "quantity_boxes" not "quantity"
- price (numeric(10,2), optional) — THIS IS THE UNIT PRICE PER BOX.
    To compute the line total: price * quantity_boxes.
    To compute total spent: SUM(price * quantity_boxes).
- created_at (timestamptz)

⚠️ KEY GOTCHA: item_number is TEXT with NO foreign key. The value may be
a manufacturer code, supplier alias, or unrecognized code. Use
find_orders_for_item tool for alias-aware searching.

═══════════════════════════════════════════════════════════════════════
TABLE: receipt — Incoming shipments
═══════════════════════════════════════════════════════════════════════

Columns:
- id (bigint, PK)
- company_id (bigint, FK to company.id)
- date (DATE, not "receipt_date") — default CURRENT_DATE
- created_at (timestamptz)

NOTE: No invoice number or PO reference columns.

═══════════════════════════════════════════════════════════════════════
TABLE: receipt_line — Line items in a received shipment
═══════════════════════════════════════════════════════════════════════

Columns:
- id (bigint, PK)
- receipt_id (bigint, FK to receipt.id, ON DELETE CASCADE)
- item_number (TEXT, NOT NULL, NO FK to item) — same alias gotcha
- quantity_boxes (INTEGER, NOT NULL) — "quantity_boxes" not "quantity"
- lot_number (TEXT, NOT NULL) — always has a value
- expiration_date (DATE, optional) — can be NULL
- created_at (timestamptz)

LOT TRACKING: Each receipt_line carries lot_number + expiration_date.
This is the source of truth for what lots are in the lab.

═══════════════════════════════════════════════════════════════════════
TABLE: usage — What the lab consumed
═══════════════════════════════════════════════════════════════════════

Columns:
- id (bigint, PK)
- item_number (TEXT, NOT NULL, NO FK) — same alias gotcha
- lot_number (TEXT, NOT NULL) — always has a value
- parts_used (INTEGER, NOT NULL, default 1) — "parts_used" NOT "quantity".
    Tracks individual parts consumed, not boxes.
- date (DATE, default CURRENT_DATE)
- created_at (timestamptz)

NOTE: No company/supplier column — usage is not tied to a supplier.

═══════════════════════════════════════════════════════════════════════
TABLES: source_document, receipt_source_document, purchase_order_source_document
═══════════════════════════════════════════════════════════════════════

source_document stores uploaded invoice/PO files. Each row represents one
uploaded file (PDF or image). Files are linked to receipts and orders via
join tables. The actual files live in Supabase Storage (private bucket).

source_document columns:
- id (bigint, PK)
- storage_path (text, NOT NULL, UNIQUE) — path within the storage bucket
- original_filename (text, NOT NULL) — user-facing name, e.g., "invoice_march.pdf"
- mime_type (text, NOT NULL) — e.g., "application/pdf", "image/png"
- size_bytes (bigint, NOT NULL)
- uploaded_at (timestamptz, default now())
- uploaded_via (text, NOT NULL) — 'receipt_extraction' | 'order_extraction' | 'manual_attach'
- context (text, NOT NULL) — 'receipt' | 'order'

receipt_source_document: join table (receipt_id, source_document_id).
  One receipt can have multiple files, one file can theoretically link to
  multiple receipts. CASCADE on receipt delete, RESTRICT on document delete.

purchase_order_source_document: same but for orders (purchase_order_id).

Common queries:
- "Which receipts have their original invoice on file?"
  → find receipts with any matching row in receipt_source_document
- "Which receipts are missing their invoice?"
  → find receipts with NO matching row in receipt_source_document (LEFT JOIN)
- "Show me the invoice for receipt X"
  → use get_source_documents_for_item or a direct query on receipt_source_document

═══════════════════════════════════════════════════════════════════════
BACKUP TABLES — DO NOT QUERY UNLESS EXPLICITLY ASKED
═══════════════════════════════════════════════════════════════════════

- item_master_v1_backup, supplier_code_v1_backup — old data, don't include.

═══════════════════════════════════════════════════════════════════════
WHAT'S NOT TRACKED
═══════════════════════════════════════════════════════════════════════

- Current stock levels (no stock-on-hand table)
    Closest proxy: SUM(receipt quantities) - SUM(usage quantities) per item
- Reorder points or par levels
- Physical storage locations (which fridge, which shelf)
- Personnel/audit info
- Patient or test result data
- Pricing history (only last_price_update timestamp)
- QC results, instrument maintenance, calibration records

═══════════════════════════════════════════════════════════════════════
COMMON QUERY PATTERNS
═══════════════════════════════════════════════════════════════════════

PATTERN: "Find anything related to item X"
  → get_item_details(X) + find_item_references(X) + dedicated *_for_item tools

PATTERN: "What expires soon"
  → list_expiring_lots(within_days: N)

PATTERN: "Compare suppliers / cheapest"
  → compare_supplier_prices(item_code)

PATTERN: "Activity in time window"
  → list_recent_activity(activity_type, since_date, until_date)

PATTERN: "Aggregates and totals"
  → aggregate_query for grouped counts/sums/averages

PATTERN: "Estimate stock on hand"
  → find_receipts_for_item + find_usage_for_item → received - used (with caveats)

PATTERN: "Data quality / orphaned codes"
  → list_unmapped_codes(source)

PATTERN: "Total spent on orders"
  → aggregate_query or run_sql_query with SUM(price * quantity_boxes)
    Remember: price is UNIT PRICE, not line total.

PATTERN: "Novel question I don't have a tool for"
  → describe_table(table_name) first → then run_sql_query as last resort
`.trim();
