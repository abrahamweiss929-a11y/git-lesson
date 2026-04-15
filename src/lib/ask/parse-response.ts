import { AskResponsePayloadSchema, type AskApiResponse } from "./types";
import type { ToolUseRecord } from "@/lib/ai-tools/types";

/**
 * Parse Claude's final text response into a structured AskApiResponse.
 * Extracts the LAST ```json``` block, validates against Zod schema,
 * and assembles the full response with tool tracking.
 */
export function parseStructuredResponse(
  textContent: string,
  toolsUsed: ToolUseRecord[]
): AskApiResponse {
  // Extract the LAST fenced ```json ... ``` block
  const regex = /```json\s*([\s\S]*?)\s*```/g;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(textContent)) !== null) {
    lastMatch = match;
  }

  if (!lastMatch) {
    throw new MalformedResponseError("No JSON block in final response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(lastMatch[1]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new MalformedResponseError(`Invalid JSON: ${msg}`);
  }

  const validated = AskResponsePayloadSchema.safeParse(parsed);
  if (!validated.success) {
    throw new MalformedResponseError(
      `Schema mismatch: ${validated.error.message}`
    );
  }

  // Find SQL used (if any)
  const sqlTool = toolsUsed.find((t) => t.name === "run_sql_query");
  const sqlUsed = sqlTool?.input?.sql
    ? String(sqlTool.input.sql)
    : undefined;

  return {
    ...validated.data,
    tools_used: toolsUsed,
    sql_used: sqlUsed,
  };
}

export class MalformedResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MalformedResponseError";
  }
}
