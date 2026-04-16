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

// Column type normalization happens AFTER Zod parsing — see parse-response.ts.
// Zod just validates the shape; we accept any string for type.
export type ColumnType = "string" | "number" | "date" | "boolean" | "currency";

// DIAGNOSTIC: Minimal schema to isolate the Zod _zod crash.
// If this works, the bug is in the nested table/column schemas.
// If this still crashes, it's a fundamental Zod 4 issue.
export const AskResponsePayloadSchema = z.object({
  answer_text: z.string(),
  result_type: z.string(),
}).passthrough();

// DIAGNOSTIC: Full type defined manually since schema is minimal for now
export interface AskResponsePayload {
  answer_text: string;
  result_type: string;
  table?: {
    columns: Array<{
      key: string;
      label: string;
      type: "string" | "number" | "boolean" | "date" | "currency";
    }>;
    rows: Array<Record<string, unknown>>;
  };
  suggested_followups?: string[];
  error?: string;
}

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
