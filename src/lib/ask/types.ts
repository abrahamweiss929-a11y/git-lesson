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

const TableColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(["string", "number", "date", "boolean", "currency"]),
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
