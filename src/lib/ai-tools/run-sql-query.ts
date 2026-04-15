import { supabaseAdmin } from "@/lib/supabase-admin";
import { registerTool } from "./index";
import { validateSql } from "./sql-safety";
import type { ToolResult } from "./types";

registerTool(
  {
    name: "run_sql_query",
    description:
      "Run a read-only SQL query for questions that don't fit the other tools. ONLY use when no specific tool can answer the question. The query MUST be a SELECT statement. STRONGLY RECOMMENDED: call describe_table first to verify column names and types before constructing SQL. Results capped at 1000 rows.",
    input_schema: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "The SQL SELECT query to run.",
        },
        explanation: {
          type: "string",
          description:
            "Plain-English explanation of what this query computes and why.",
        },
      },
      required: ["sql", "explanation"],
    },
  },
  async (input): Promise<ToolResult> => {
    const sql = String(input.sql || "").trim();
    const explanation = String(input.explanation || "");

    if (!sql) {
      return {
        ok: false,
        error: { code: "BAD_INPUT", message: "sql is required" },
      };
    }

    // Validate and sanitize
    const validation = validateSql(sql);
    if (!validation.ok) {
      return {
        ok: false,
        error: { code: "SQL_REJECTED", message: validation.reason },
      };
    }

    // Log for audit
    console.log(
      `[AI SQL] Explanation: ${explanation}\n[AI SQL] Query: ${validation.sanitizedSql}`
    );

    // Execute via the RPC function (service_role only)
    const { data, error } = await supabaseAdmin.rpc("execute_readonly_sql", {
      query_text: validation.sanitizedSql,
    });

    if (error) {
      // Check for common Postgres errors
      const msg = error.message || "";
      if (msg.includes("statement timeout")) {
        return {
          ok: false,
          error: {
            code: "TIMEOUT",
            message:
              "Query took too long (>5s). Try a simpler query or add more specific WHERE clauses.",
          },
        };
      }
      if (msg.includes("read-only transaction") || msg.includes("read_only")) {
        return {
          ok: false,
          error: {
            code: "READ_ONLY",
            message: "Write operations are not allowed. Only SELECT queries.",
          },
        };
      }
      return {
        ok: false,
        error: { code: "DB_ERROR", message: msg },
      };
    }

    const rows = data ?? [];
    const capped = rows.length === 1000;

    return {
      ok: true,
      data: rows,
      summary: `Returned ${rows.length} rows${capped ? " (capped at 1000 — try narrowing your query)" : ""}`,
    };
  }
);
