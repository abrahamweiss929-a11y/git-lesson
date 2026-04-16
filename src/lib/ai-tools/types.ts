// Standard tool result shape — every tool returns this format.
export type ToolResult<T = unknown> =
  | { ok: true; data: T; summary: string; _full_data_for_response?: T }
  | { ok: false; error: { code: string; message: string } };

// Record of a tool call for the tools_used array in the response.
export interface ToolUseRecord {
  name: string;
  input: Record<string, unknown>;
  result_summary: string;
}

// Anthropic tool definition shape.
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

// Tool handler function signature.
export type ToolHandler = (
  input: Record<string, unknown>
) => Promise<ToolResult>;
