import { z } from "zod";

// --- Request validation ---

export const AskRequestSchema = z.object({
  question: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Question is required").max(2000, "Question too long (max 2000 characters)")),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      })
    )
    .max(20)
    .optional()
    .default([]),
});

export type AskRequest = z.infer<typeof AskRequestSchema>;

// --- Response schema (what Claude must produce in its JSON block) ---

// Accept any string for column type — the AI might use "text", "integer", etc.
// We normalize to our known types in the frontend; unknown types render as string.
const KNOWN_COLUMN_TYPES = ["string", "number", "date", "boolean", "currency"] as const;
type ColumnType = typeof KNOWN_COLUMN_TYPES[number];

const TableColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.string().transform((t): ColumnType => {
    const lower = t.toLowerCase();
    if (KNOWN_COLUMN_TYPES.includes(lower as ColumnType)) return lower as ColumnType;
    // Map common alternatives
    if (["text", "varchar"].includes(lower)) return "string";
    if (["integer", "int", "float", "decimal", "numeric", "bigint"].includes(lower)) return "number";
    if (["timestamp", "timestamptz", "datetime"].includes(lower)) return "date";
    if (["bool"].includes(lower)) return "boolean";
    if (["money", "price"].includes(lower)) return "currency";
    return "string"; // fallback
  }),
});

const TableSchema = z.object({
  columns: z.array(TableColumnSchema),
  rows: z.array(z.record(z.unknown())),
});

export const AskResponsePayloadSchema = z.object({
  answer_text: z.string(),
  result_type: z.enum(["scalar", "table", "narrative", "error"]),
  table: TableSchema.optional(),
  suggested_followups: z.array(z.string()).optional().default([]),
  error: z.string().optional(),
});

export type AskResponsePayload = z.infer<typeof AskResponsePayloadSchema>;

// --- Full API response (includes tool tracking) ---

export interface ToolUsedEntry {
  name: string;
  input: Record<string, unknown>;
  result_summary: string;
}

export interface AskApiResponse extends AskResponsePayload {
  tools_used: ToolUsedEntry[];
  sql_used?: string;
}
