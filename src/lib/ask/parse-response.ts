import {
  AskResponsePayloadSchema,
  type AskApiResponse,
  type ColumnType,
} from "./types";
import type { ToolUseRecord } from "@/lib/ai-tools/types";

/** Normalize AI-provided column type to our known set. */
function normalizeColumnType(raw: string): ColumnType {
  const t = raw.toLowerCase();
  if (["string", "number", "date", "boolean", "currency"].includes(t))
    return t as ColumnType;
  if (["text", "varchar"].includes(t)) return "string";
  if (["integer", "int", "float", "decimal", "numeric", "bigint"].includes(t))
    return "number";
  if (["timestamp", "timestamptz", "datetime"].includes(t)) return "date";
  if (t === "bool") return "boolean";
  if (["money", "price"].includes(t)) return "currency";
  return "string";
}

/**
 * Parse Claude's final text response into a structured AskApiResponse.
 * Extracts the LAST ```json``` block, validates against Zod schema,
 * and assembles the full response with tool tracking.
 */
export function parseStructuredResponse(
  textContent: string,
  toolsUsed: ToolUseRecord[]
): AskApiResponse {
  console.log(
    "[AI Ask] Parsing final response. Text length:",
    textContent.length
  );
  console.log(
    "[AI Ask] Final text (first 500 chars):",
    textContent.slice(0, 500)
  );

  // Extract the LAST fenced ```json ... ``` block (case-insensitive)
  const regex = /```json\s*([\s\S]*?)\s*```/gi;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(textContent)) !== null) {
    lastMatch = match;
  }

  // Fallback: try plain ``` ... ``` blocks (AI might omit "json" label)
  if (!lastMatch) {
    const plainRegex = /```\s*([\s\S]*?)\s*```/g;
    while ((match = plainRegex.exec(textContent)) !== null) {
      // Check if the content looks like JSON
      const content = match[1].trim();
      if (content.startsWith("{")) {
        lastMatch = match;
      }
    }
  }

  // Fallback 2: try to find a raw JSON object in the text
  if (!lastMatch) {
    const jsonStart = textContent.lastIndexOf('{"answer_text"');
    if (jsonStart !== -1) {
      // Find the matching closing brace
      let depth = 0;
      let jsonEnd = -1;
      for (let i = jsonStart; i < textContent.length; i++) {
        if (textContent[i] === "{") depth++;
        if (textContent[i] === "}") {
          depth--;
          if (depth === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
      if (jsonEnd !== -1) {
        console.log("[AI Ask] Found raw JSON object (no fences)");
        lastMatch = [
          textContent.slice(jsonStart, jsonEnd),
          textContent.slice(jsonStart, jsonEnd),
        ] as unknown as RegExpExecArray;
      }
    }
  }

  if (!lastMatch) {
    console.error("[AI Ask] NO JSON block found in final response");
    console.error(
      "[AI Ask] Full text:",
      textContent.slice(0, 2000)
    );
    throw new MalformedResponseError("No JSON block in final response");
  }

  const rawJson = lastMatch[1].trim();
  console.log("[AI Ask] Extracted JSON (first 300 chars):", rawJson.slice(0, 300));

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[AI Ask] JSON parse error:", msg);
    console.error("[AI Ask] Raw JSON:", rawJson.slice(0, 500));
    throw new MalformedResponseError(`Invalid JSON: ${msg}`);
  }

  console.log("[AI Ask] JSON parsed successfully, validating schema...");

  const validated = AskResponsePayloadSchema.safeParse(parsed);
  if (!validated.success) {
    console.error(
      "[AI Ask] Zod validation failed:",
      JSON.stringify(validated.error.issues, null, 2)
    );
    console.error(
      "[AI Ask] Parsed object keys:",
      Object.keys(parsed as Record<string, unknown>)
    );
    throw new MalformedResponseError(
      `Schema mismatch: ${validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
    );
  }

  console.log("[AI Ask] Response validated successfully");

  // Normalize column types (Zod accepts any string; we map to known types)
  const data = validated.data;
  if (data.table) {
    data.table.columns = data.table.columns.map((col) => ({
      ...col,
      type: normalizeColumnType(col.type),
    }));
  }

  // Find SQL used (if any)
  const sqlTool = toolsUsed.find((t) => t.name === "run_sql_query");
  const sqlUsed = sqlTool?.input?.sql
    ? String(sqlTool.input.sql)
    : undefined;

  return {
    ...data,
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
