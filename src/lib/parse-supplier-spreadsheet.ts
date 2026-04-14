import * as XLSX from "xlsx";
import type { Item, Company } from "@/lib/types";

export interface ParsedSupplierRow {
  item_code: string;
  supplier_name: string;
  their_item_code: string | null;
  price: number | null;
  currency: string | null;
  notes: string | null;
}

export type SupplierParseResult =
  | { success: true; rows: ParsedSupplierRow[] }
  | { success: false; error: string };

export interface ResolvedSupplierRow extends ParsedSupplierRow {
  item_id: number;
  company_id: number;
}

export interface SupplierImportAnalysis {
  readyToImport: ResolvedSupplierRow[];
  missingItemCodes: string[];
  missingCompanies: string[];
}

const COLUMN_MAP: Record<string, keyof ParsedSupplierRow> = {
  "item code": "item_code",
  supplier: "supplier_name",
  "supplier name": "supplier_name",
  "their item code": "their_item_code",
  price: "price",
  currency: "currency",
  notes: "notes",
};

function normalizeHeader(header: unknown): string {
  return String(header ?? "")
    .trim()
    .toLowerCase();
}

function stringOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  return s || null;
}

function parsePrice(
  value: unknown,
  rowNum: number
): { value: number | null; error?: string } {
  if (value == null || value === "") return { value: null };
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return {
      value: null,
      error: `Row ${rowNum}: "Price" must be a number, got "${value}".`,
    };
  }
  return { value: Math.round(n * 100) / 100 }; // round to 2 decimal places
}

export async function parseSupplierSpreadsheet(
  file: File
): Promise<SupplierParseResult> {
  let wb: XLSX.WorkBook;
  try {
    const buffer = await file.arrayBuffer();
    wb = XLSX.read(buffer, { type: "array" });
  } catch {
    return {
      success: false,
      error:
        "Could not read file. Make sure it is a valid .xlsx, .xls, or .csv file.",
    };
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { success: false, error: "File contains no sheets." };
  }

  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  if (raw.length < 2) {
    return {
      success: false,
      error:
        "No data rows found. The file must have a header row and at least one data row.",
    };
  }

  // Parse header row
  const headerRow = raw[0] as unknown[];
  const colIndex: Partial<Record<keyof ParsedSupplierRow, number>> = {};

  for (let i = 0; i < headerRow.length; i++) {
    const normalized = normalizeHeader(headerRow[i]);
    const mapped = COLUMN_MAP[normalized];
    if (mapped && colIndex[mapped] == null) {
      colIndex[mapped] = i;
    }
  }

  if (colIndex.item_code == null) {
    return {
      success: false,
      error:
        'Missing required column: "Item Code". Make sure the header row contains this column.',
    };
  }

  if (colIndex.supplier_name == null) {
    return {
      success: false,
      error:
        'Missing required column: "Supplier". Make sure the header row contains this column.',
    };
  }

  // Parse data rows
  const rows: ParsedSupplierRow[] = [];
  const codeIdx = colIndex.item_code;
  const supplierIdx = colIndex.supplier_name;
  const seenPairs = new Map<string, number>(); // "code|supplier" → first row

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    const rowNum = i + 1;

    // Skip entirely empty rows
    if (!row || row.every((cell) => cell == null || cell === "")) {
      continue;
    }

    const code = String(row[codeIdx] ?? "").trim();
    const supplier = String(row[supplierIdx] ?? "").trim();

    if (!code) {
      return {
        success: false,
        error: `Row ${rowNum}: Item Code is required.`,
      };
    }

    if (!supplier) {
      return {
        success: false,
        error: `Row ${rowNum}: Supplier is required.`,
      };
    }

    // Check for duplicate (item_code, supplier) pairs within the file
    const pairKey = `${code.toLowerCase()}|${supplier.toLowerCase()}`;
    const firstRow = seenPairs.get(pairKey);
    if (firstRow != null) {
      return {
        success: false,
        error: `Duplicate (Item Code, Supplier) pair "${code}" / "${supplier}" found on rows ${firstRow} and ${rowNum}.`,
      };
    }
    seenPairs.set(pairKey, rowNum);

    // Parse price with strict validation
    let price: number | null = null;
    if (colIndex.price != null) {
      const result = parsePrice(row[colIndex.price], rowNum);
      if (result.error) {
        return { success: false, error: result.error };
      }
      price = result.value;
    }

    rows.push({
      item_code: code,
      supplier_name: supplier,
      their_item_code:
        colIndex.their_item_code != null
          ? stringOrNull(row[colIndex.their_item_code])
          : null,
      price,
      currency:
        colIndex.currency != null ? stringOrNull(row[colIndex.currency]) : null,
      notes: colIndex.notes != null ? stringOrNull(row[colIndex.notes]) : null,
    });
  }

  if (rows.length === 0) {
    return {
      success: false,
      error: "No data rows found after skipping empty rows.",
    };
  }

  return { success: true, rows };
}

export function analyzeSupplierImport(
  rows: ParsedSupplierRow[],
  items: Pick<Item, "id" | "item_code">[],
  companies: Pick<Company, "id" | "name">[]
): SupplierImportAnalysis {
  // Build lookup maps (case-insensitive)
  const itemMap = new Map<string, number>();
  for (const item of items) {
    itemMap.set(item.item_code.toLowerCase().trim(), item.id);
  }

  const companyMap = new Map<string, number>();
  for (const c of companies) {
    companyMap.set(c.name.toLowerCase().trim(), c.id);
  }

  const readyToImport: ResolvedSupplierRow[] = [];
  const missingItemCodesSet = new Set<string>();
  const missingCompaniesSet = new Set<string>();

  for (const row of rows) {
    const itemId = itemMap.get(row.item_code.toLowerCase().trim());
    const companyId = companyMap.get(row.supplier_name.toLowerCase().trim());

    if (itemId == null) {
      missingItemCodesSet.add(row.item_code);
    }
    if (companyId == null) {
      missingCompaniesSet.add(row.supplier_name);
    }

    if (itemId != null && companyId != null) {
      readyToImport.push({ ...row, item_id: itemId, company_id: companyId });
    }
  }

  return {
    readyToImport,
    missingItemCodes: Array.from(missingItemCodesSet),
    missingCompanies: Array.from(missingCompaniesSet),
  };
}
