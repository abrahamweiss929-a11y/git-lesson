import type {
  ToolDefinition,
  ToolHandler,
  ToolResult,
  ToolUseRecord,
} from "./types";

// Registry populated by tool modules via registerTool().
const toolHandlers = new Map<string, ToolHandler>();
const toolDefinitions: ToolDefinition[] = [];

export function registerTool(def: ToolDefinition, handler: ToolHandler) {
  toolHandlers.set(def.name, handler);
  toolDefinitions.push(def);
}

export function getToolDefinitions(): ToolDefinition[] {
  return toolDefinitions;
}

// Max rows the AI sees in the tool_result content.
const MAX_ROWS_FOR_AI = 100;
// Max rows that flow through to the final user-facing response.
const MAX_ROWS_FOR_USER = 1000;

/**
 * Execute a tool by name, track usage, and cap result size.
 * Returns the stringified result for Anthropic's tool_result content.
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  tracker: ToolUseRecord[]
): Promise<string> {
  const handler = toolHandlers.get(name);
  if (!handler) {
    const result: ToolResult = {
      ok: false,
      error: { code: "UNKNOWN_TOOL", message: `No tool named "${name}"` },
    };
    tracker.push({ name, input, result_summary: `Error: unknown tool` });
    return JSON.stringify(result);
  }

  let result: ToolResult;
  try {
    result = await handler(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    result = {
      ok: false,
      error: { code: "TOOL_EXCEPTION", message },
    };
  }

  // Track usage
  if (result.ok) {
    tracker.push({ name, input, result_summary: result.summary });
  } else {
    tracker.push({
      name,
      input,
      result_summary: `Error: ${result.error.message}`,
    });
  }

  // Cap array results for the AI (keep full data for user response)
  if (result.ok && Array.isArray(result.data)) {
    const totalRows = result.data.length;
    if (totalRows > MAX_ROWS_FOR_AI) {
      const fullData = result.data.slice(0, MAX_ROWS_FOR_USER);
      const aiResult: ToolResult = {
        ok: true,
        data: result.data.slice(0, MAX_ROWS_FOR_AI),
        summary: `Returned first ${MAX_ROWS_FOR_AI} of ${totalRows} rows. Full result available in download.`,
        _full_data_for_response: fullData,
      };
      return JSON.stringify(aiResult);
    }
  }

  return JSON.stringify(result);
}

// Import all tool modules to trigger registration.
// Each module calls registerTool() at the top level.
export async function ensureToolsRegistered() {
  if (toolDefinitions.length > 0) return; // already loaded
  await import("./search-items");
  await import("./get-item-details");
  await import("./find-item-references");
  await import("./list-suppliers");
  await import("./compare-supplier-prices");
  await import("./find-orders-for-item");
  await import("./find-receipts-for-item");
  await import("./find-usage-for-item");
  await import("./list-recent-activity");
  await import("./list-expiring-lots");
  await import("./list-unmapped-codes");
  await import("./aggregate-query");
  await import("./describe-table");
  await import("./run-sql-query");
}
