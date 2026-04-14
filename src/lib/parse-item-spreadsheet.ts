import * as XLSX from "xlsx";
import type { Item } from "@/lib/types";

export interface ParsedItemRow {
  item_code: string;
  item_name: string | null;
  manufacturer: string | null;
  manufacturer_verified: boolean;
  parts_per_box: number | null;
  tests_per_box: number | null;
  shelf_life_days: number | null;
  test_type: string | null;
  machine: string | null;
  item_type: string | null;
  category: string | null;
  storage_requirements: string | null;
  average_order_qty: number | null;
  notes: string | null;
}

export type ParseResult =
  | { success: true; rows: ParsedItemRow[] }
  | { success: false; error: string };

export interface ImportDiff {
  toInsert: ParsedItemRow[];
  toUpdate: (ParsedItemRow & { existingId: number })[];
}

// Column header normalization map — maps lowercased header text to field names.
// Includes backward-compat mappings from v2 headers.
const COLUMN_MAP: Record<string, keyof ParsedItemRow> = {
  "item code": "item_code",
  "internal name": "item_code", // backward compat
  "item name": "item_name",
  name: "item_name",
  manufacturer: "manufacturer",
  "manufacturer verified": "manufacturer_verified",
  "parts per box": "parts_per_box",
  "tests per box": "tests_per_box",
  "shelf life (days)": "shelf_life_days",
  "shelf life days": "shelf_life_days",
  "shelf life": "shelf_life_days",
  "default shelf life (days)": "shelf_life_days", // backward compat
  "default shelf life": "shelf_life_days", // backward compat
  "test type": "test_type",
  machine: "machine",
  "item type": "item_type",
  category: "category",
  "storage requirements": "storage_requirements",
  "average order qty": "average_order_qty",
  notes: "notes",
};

const NUMERIC_FIELDS: Set<keyof ParsedItemRow> = new Set([
  "parts_per_box",
  "tests_per_box",
  "shelf_life_days",
  "average_order_qty",
]);

function normalizeHeader(header: unknown): string {
  return String(header ?? "")
    .trim()
    .toLowerCase();
}

function parseIntStrict(
  value: unknown,
  fieldName: string,
  rowNum: number
): { value: number | null; error?: string } {
  if (value == null || value === "") return { value: null };
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return {
      value: null,
      error: `Row ${rowNum}: "${fieldName}" must be a number, got "${value}".`,
    };
  }
  return { value: Math.round(n) };
}

function parseBooleanOrNull(
  value: unknown,
  rowNum: number
): { value: boolean; error?: string } {
  if (value == null || value === "") return { value: false };
  const s = String(value).trim().toLowerCase();
  if (["true", "yes", "1"].includes(s)) return { value: true };
  if (["false", "no", "0"].includes(s)) return { value: false };
  return {
    value: false,
    error: `Row ${rowNum}: "Manufacturer Verified" must be true/false/yes/no/1/0 or blank, got "${value}".`,
  };
}

function stringOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  return s || null;
}

export async function parseItemSpreadsheet(
  file: File
): Promise<ParseResult> {
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
  const colIndex: Partial<Record<keyof ParsedItemRow, number>> = {};

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

  // Parse data rows
  const rows: ParsedItemRow[] = [];
  const codeIdx = colIndex.item_code;
  const seenCodes = new Map<string, number>(); // lowercased code → first row number

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    const rowNum = i + 1; // 1-based for user display

    // Skip entirely empty rows
    if (!row || row.every((cell) => cell == null || cell === "")) {
      continue;
    }

    const rawCode = row[codeIdx];
    const code = String(rawCode ?? "").trim();

    if (!code) {
      return {
        success: false,
        error: `Row ${rowNum}: Item Code is required.`,
      };
    }

    // Check for duplicates within the file
    const codeLower = code.toLowerCase();
    const firstRow = seenCodes.get(codeLower);
    if (firstRow != null) {
      return {
        success: false,
        error: `Duplicate Item Code "${code}" found on rows ${firstRow} and ${rowNum}.`,
      };
    }
    seenCodes.set(codeLower, rowNum);

    // Parse numeric fields with strict validation
    const numericValues: Partial<
      Record<"parts_per_box" | "tests_per_box" | "shelf_life_days" | "average_order_qty", number | null>
    > = {};

    for (const field of NUMERIC_FIELDS) {
      if (colIndex[field] != null) {
        const cellValue = row[colIndex[field]!];
        const result = parseIntStrict(cellValue, field.replace(/_/g, " "), rowNum);
        if (result.error) {
          return { success: false, error: result.error };
        }
        numericValues[field as keyof typeof numericValues] = result.value;
      }
    }

    // Parse manufacturer_verified boolean
    let manufacturerVerified = false;
    if (colIndex.manufacturer_verified != null) {
      const boolResult = parseBooleanOrNull(
        row[colIndex.manufacturer_verified],
        rowNum
      );
      if (boolResult.error) {
        return { success: false, error: boolResult.error };
      }
      manufacturerVerified = boolResult.value;
    }

    rows.push({
      item_code: code,
      item_name:
        colIndex.item_name != null ? stringOrNull(row[colIndex.item_name]) : null,
      manufacturer:
        colIndex.manufacturer != null
          ? stringOrNull(row[colIndex.manufacturer])
          : null,
      manufacturer_verified: manufacturerVerified,
      parts_per_box: numericValues.parts_per_box ?? null,
      tests_per_box: numericValues.tests_per_box ?? null,
      shelf_life_days: numericValues.shelf_life_days ?? null,
      test_type:
        colIndex.test_type != null ? stringOrNull(row[colIndex.test_type]) : null,
      machine:
        colIndex.machine != null ? stringOrNull(row[colIndex.machine]) : null,
      item_type:
        colIndex.item_type != null ? stringOrNull(row[colIndex.item_type]) : null,
      category:
        colIndex.category != null ? stringOrNull(row[colIndex.category]) : null,
      storage_requirements:
        colIndex.storage_requirements != null
          ? stringOrNull(row[colIndex.storage_requirements])
          : null,
      average_order_qty: numericValues.average_order_qty ?? null,
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

export function diffWithExisting(
  rows: ParsedItemRow[],
  existingItems: Item[]
): ImportDiff {
  const existingMap = new Map<string, Item>();
  for (const item of existingItems) {
    existingMap.set(item.item_code.toLowerCase().trim(), item);
  }

  const toInsert: ParsedItemRow[] = [];
  const toUpdate: (ParsedItemRow & { existingId: number })[] = [];

  for (const row of rows) {
    const existing = existingMap.get(row.item_code.toLowerCase().trim());
    if (existing) {
      toUpdate.push({ ...row, existingId: existing.id });
    } else {
      toInsert.push(row);
    }
  }

  return { toInsert, toUpdate };
}
