import { supabaseAdmin } from "@/lib/supabase-admin";
import { registerTool } from "./index";
import type { ToolResult } from "./types";

// Allowed tables and their valid columns for aggregation.
const ALLOWED_TABLES: Record<string, string[]> = {
  item: [
    "id", "item_code", "item_name", "manufacturer", "category", "machine",
    "test_type", "item_type", "storage_requirements", "parts_per_box",
    "tests_per_box", "shelf_life_days", "average_order_qty", "created_at",
  ],
  item_supplier: [
    "id", "item_id", "company_id", "their_item_code", "price", "currency",
    "last_price_update", "created_at",
  ],
  company: ["id", "name", "created_at"],
  purchase_order: ["id", "company_id", "date", "created_at"],
  purchase_order_line: [
    "id", "purchase_order_id", "item_number", "quantity_boxes", "price",
    "created_at",
  ],
  receipt: ["id", "company_id", "date", "created_at"],
  receipt_line: [
    "id", "receipt_id", "item_number", "quantity_boxes", "lot_number",
    "expiration_date", "created_at",
  ],
  usage: ["id", "item_number", "lot_number", "parts_used", "date", "created_at"],
};

registerTool(
  {
    name: "aggregate_query",
    description:
      "Run aggregate calculations — counts, sums, averages grouped by a field. Use for 'total spent per supplier', 'items per category', 'average price by manufacturer', etc. NOTE: purchase_order_line.price is the UNIT PRICE per box. To compute line totals, multiply price * quantity_boxes.",
    input_schema: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Plain-English description of what you're computing.",
        },
        table: {
          type: "string",
          description:
            "The table to aggregate. One of: item, item_supplier, company, purchase_order, purchase_order_line, receipt, receipt_line, usage.",
        },
        group_by: {
          type: "string",
          description:
            "Column name to group by. Must be a valid column in the table.",
        },
        aggregate: {
          type: "string",
          enum: ["count", "sum", "avg"],
          description: "The aggregate function. Default: count.",
        },
        aggregate_column: {
          type: "string",
          description:
            "Column to sum or average (required for sum/avg, ignored for count).",
        },
        filters: {
          type: "object",
          description:
            "Key-value filters to apply before aggregating. Keys are column names, values are exact matches.",
        },
      },
      required: ["table"],
    },
  },
  async (input): Promise<ToolResult> => {
    const table = String(input.table);
    if (!ALLOWED_TABLES[table]) {
      return {
        ok: false,
        error: {
          code: "BAD_INPUT",
          message: `Table '${table}' not allowed. Use: ${Object.keys(ALLOWED_TABLES).join(", ")}`,
        },
      };
    }

    const validCols = ALLOWED_TABLES[table];
    const groupBy = input.group_by ? String(input.group_by) : undefined;
    const agg = String(input.aggregate || "count");
    const aggCol = input.aggregate_column
      ? String(input.aggregate_column)
      : undefined;

    if (groupBy && !validCols.includes(groupBy)) {
      return {
        ok: false,
        error: {
          code: "BAD_INPUT",
          message: `Column '${groupBy}' not valid for table '${table}'. Valid: ${validCols.join(", ")}`,
        },
      };
    }
    if (aggCol && !validCols.includes(aggCol)) {
      return {
        ok: false,
        error: {
          code: "BAD_INPUT",
          message: `Column '${aggCol}' not valid for table '${table}'. Valid: ${validCols.join(", ")}`,
        },
      };
    }

    // Build the select expression
    let selectExpr: string;
    if (groupBy) {
      if (agg === "count") {
        selectExpr = `${groupBy}, count:id.count()`;
      } else if (agg === "sum" && aggCol) {
        selectExpr = `${groupBy}, total:${aggCol}.sum()`;
      } else if (agg === "avg" && aggCol) {
        selectExpr = `${groupBy}, average:${aggCol}.avg()`;
      } else {
        selectExpr = `${groupBy}, count:id.count()`;
      }
    } else {
      if (agg === "count") {
        selectExpr = "count:id.count()";
      } else if (agg === "sum" && aggCol) {
        selectExpr = `total:${aggCol}.sum()`;
      } else if (agg === "avg" && aggCol) {
        selectExpr = `average:${aggCol}.avg()`;
      } else {
        selectExpr = "count:id.count()";
      }
    }

    // We need to use the RPC approach for proper GROUP BY since
    // Supabase JS client doesn't support GROUP BY natively in all cases.
    // Build a raw SQL query for reliability.
    const aggExpr =
      agg === "count"
        ? "COUNT(*) AS count"
        : agg === "sum" && aggCol
          ? `SUM(${aggCol}) AS total`
          : agg === "avg" && aggCol
            ? `AVG(${aggCol}) AS average`
            : "COUNT(*) AS count";

    const selectCols = groupBy ? `${groupBy}, ${aggExpr}` : aggExpr;
    const whereClauses: string[] = [];

    if (input.filters && typeof input.filters === "object") {
      const filters = input.filters as Record<string, unknown>;
      for (const [key, value] of Object.entries(filters)) {
        if (!validCols.includes(key)) continue;
        // Sanitize value — only allow simple scalar values
        const v = String(value).replace(/'/g, "''");
        whereClauses.push(`LOWER(TRIM(${key}::text)) = LOWER(TRIM('${v}'))`);
      }
    }

    const whereStr =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const groupStr = groupBy ? `GROUP BY ${groupBy}` : "";
    const orderStr = groupBy
      ? `ORDER BY ${agg === "count" ? "count" : agg === "sum" ? "total" : "average"} DESC`
      : "";

    const sql = `SELECT ${selectCols} FROM ${table} ${whereStr} ${groupStr} ${orderStr} LIMIT 500`;

    const { data, error } = await supabaseAdmin.rpc("execute_readonly_sql", {
      query_text: sql,
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
      summary: `${agg.toUpperCase()}${groupBy ? ` grouped by ${groupBy}` : ""}: ${rows.length} result(s)`,
    };
  }
);
