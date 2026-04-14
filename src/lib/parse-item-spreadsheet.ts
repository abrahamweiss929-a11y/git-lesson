import * as XLSX from "xlsx";
import type { ItemMaster } from "@/lib/types";

export interface ParsedItemRow {
  internal_name: string;
  parts_per_box: number | null;
  tests_per_box: number | null;
  default_shelf_life: number | null;
}

export type ParseResult =
  | { success: true; rows: ParsedItemRow[] }
  | { success: false; error: string };

export interface ImportDiff {
  toInsert: ParsedItemRow[];
  toUpdate: (ParsedItemRow & { existingId: number })[];
}

// Column header normalization map
const COLUMN_MAP: Record<string, keyof ParsedItemRow> = {
  "internal name": "internal_name",
  "parts per box": "parts_per_box",
  "tests per box": "tests_per_box",
  "default shelf life (days)": "default_shelf_life",
  "default shelf life": "default_shelf_life",
  "shelf life (days)": "default_shelf_life",
  "shelf life": "default_shelf_life",
};

function normalizeHeader(header: unknown): string {
  return String(header ?? "")
    .trim()
    .toLowerCase();
}

function parseIntOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i;
}

export async function parseItemSpreadsheet(
  file: File
): Promise<ParseResult> {
  let wb: XLSX.WorkBook;
  try {
    const buffer = await file.arrayBuffer();
    wb = XLSX.read(buffer, { type: "array" });
  } catch {
    return { success: false, error: "Could not read file. Make sure it is a valid .xlsx, .xls, or .csv file." };
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { success: false, error: "File contains no sheets." };
  }

  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  if (raw.length < 2) {
    return { success: false, error: "No data rows found. The file must have a header row and at least one data row." };
  }

  // Parse header row
  const headerRow = raw[0] as unknown[];
  const colIndex: Partial<Record<keyof ParsedItemRow, number>> = {};

  for (let i = 0; i < headerRow.length; i++) {
    const normalized = normalizeHeader(headerRow[i]);
    const mapped = COLUMN_MAP[normalized];
    if (mapped) {
      colIndex[mapped] = i;
    }
  }

  if (colIndex.internal_name == null) {
    return {
      success: false,
      error: 'Missing required column: "Internal Name". Make sure the header row contains this column.',
    };
  }

  // Parse data rows
  const rows: ParsedItemRow[] = [];
  const nameIndex = colIndex.internal_name;
  const seenNames = new Map<string, number>(); // lowercased name -> first row number

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    const rowNum = i + 1; // 1-based for user display

    // Skip entirely empty rows
    if (!row || row.every((cell) => cell == null || cell === "")) {
      continue;
    }

    const rawName = row[nameIndex];
    const name = String(rawName ?? "").trim();

    if (!name) {
      return {
        success: false,
        error: `Row ${rowNum}: Internal Name is required.`,
      };
    }

    // Check for duplicates within the file
    const nameLower = name.toLowerCase();
    const firstRow = seenNames.get(nameLower);
    if (firstRow != null) {
      return {
        success: false,
        error: `Duplicate Internal Name "${name}" found on rows ${firstRow} and ${rowNum}.`,
      };
    }
    seenNames.set(nameLower, rowNum);

    rows.push({
      internal_name: name,
      parts_per_box:
        colIndex.parts_per_box != null
          ? parseIntOrNull(row[colIndex.parts_per_box])
          : null,
      tests_per_box:
        colIndex.tests_per_box != null
          ? parseIntOrNull(row[colIndex.tests_per_box])
          : null,
      default_shelf_life:
        colIndex.default_shelf_life != null
          ? parseIntOrNull(row[colIndex.default_shelf_life])
          : null,
    });
  }

  if (rows.length === 0) {
    return { success: false, error: "No data rows found after skipping empty rows." };
  }

  return { success: true, rows };
}

export function diffWithExisting(
  rows: ParsedItemRow[],
  existingItems: ItemMaster[]
): ImportDiff {
  const existingMap = new Map<string, ItemMaster>();
  for (const item of existingItems) {
    existingMap.set(item.internal_name.toLowerCase(), item);
  }

  const toInsert: ParsedItemRow[] = [];
  const toUpdate: (ParsedItemRow & { existingId: number })[] = [];

  for (const row of rows) {
    const existing = existingMap.get(row.internal_name.toLowerCase());
    if (existing) {
      toUpdate.push({ ...row, existingId: existing.id });
    } else {
      toInsert.push(row);
    }
  }

  return { toInsert, toUpdate };
}
