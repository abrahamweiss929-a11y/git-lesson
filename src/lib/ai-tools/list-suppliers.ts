import { supabaseAdmin } from "@/lib/supabase-admin";
import { registerTool } from "./index";
import type { ToolResult } from "./types";

registerTool(
  {
    name: "list_suppliers",
    description:
      "List all suppliers (companies). Optionally filter to only those with recent orders or receipts.",
    input_schema: {
      type: "object",
      properties: {
        active_only: {
          type: "boolean",
          description:
            "If true, only return suppliers that have at least one order or receipt.",
        },
        since_days: {
          type: "integer",
          description:
            "If set with active_only, only count activity within this many days.",
        },
      },
      required: [],
    },
  },
  async (input): Promise<ToolResult> => {
    if (input.active_only) {
      // Get companies that appear in recent orders or receipts
      const sinceDays = Number(input.since_days) || 365;
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - sinceDays);
      const sinceDateStr = sinceDate.toISOString().slice(0, 10);

      const { data, error } = await supabaseAdmin.rpc("execute_readonly_sql", {
        query_text: `
          SELECT c.id, c.name,
            COUNT(DISTINCT po.id) AS order_count,
            COUNT(DISTINCT r.id) AS receipt_count
          FROM company c
          LEFT JOIN purchase_order po ON po.company_id = c.id AND po.date >= '${sinceDateStr}'
          LEFT JOIN receipt r ON r.company_id = c.id AND r.date >= '${sinceDateStr}'
          GROUP BY c.id, c.name
          HAVING COUNT(DISTINCT po.id) > 0 OR COUNT(DISTINCT r.id) > 0
          ORDER BY c.name
        `,
      });

      if (error) {
        return {
          ok: false,
          error: { code: "DB_ERROR", message: error.message },
        };
      }

      const rows = data ?? [];
      return {
        ok: true,
        data: rows,
        summary: `Found ${rows.length} active suppliers (within ${sinceDays} days)`,
      };
    }

    // Simple: list all companies
    const { data, error } = await supabaseAdmin
      .from("company")
      .select("id, name, created_at")
      .order("name");

    if (error) {
      return {
        ok: false,
        error: { code: "DB_ERROR", message: error.message },
      };
    }

    return {
      ok: true,
      data: data ?? [],
      summary: `Found ${data?.length ?? 0} suppliers`,
    };
  }
);
