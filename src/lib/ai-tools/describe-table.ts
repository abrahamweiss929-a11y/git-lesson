import { supabaseAdmin } from "@/lib/supabase-admin";
import { registerTool } from "./index";
import { TABLE_METADATA } from "./table-metadata";
import type { ToolResult } from "./types";

const ALLOWED_TABLES = new Set(Object.keys(TABLE_METADATA));

registerTool(
  {
    name: "describe_table",
    description:
      "Get rich metadata about a database table — full column list with types, descriptions, sample values, common queries, and gotchas. Call this when you're about to use run_sql_query against a table you're unsure about, or when answering a novel question and you want to confirm the data structure.",
    input_schema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description:
            "Name of the table. Allowed: item, item_supplier, company, purchase_order, purchase_order_line, receipt, receipt_line, usage.",
        },
      },
      required: ["table_name"],
    },
  },
  async (input): Promise<ToolResult> => {
    const tableName = String(input.table_name).toLowerCase().trim();

    if (!ALLOWED_TABLES.has(tableName)) {
      return {
        ok: false,
        error: {
          code: "BAD_INPUT",
          message: `Table '${tableName}' not allowed. Allowed: ${[...ALLOWED_TABLES].join(", ")}`,
        },
      };
    }

    const meta = TABLE_METADATA[tableName];

    // Get estimated row count from pg_class (instant, no table scan)
    let rowCountEstimate = 0;
    try {
      const { data: countData } = await supabaseAdmin.rpc(
        "execute_readonly_sql",
        {
          query_text: `SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = '${tableName}'`,
        }
      );
      if (countData && countData.length > 0) {
        rowCountEstimate = Number(countData[0].estimate) || 0;
      }
    } catch {
      // Non-fatal — just report 0
    }

    // Get sample values for non-skip columns
    const columnsWithSamples = await Promise.all(
      meta.columns.map(async (col) => {
        if (col.skip_sample_values) {
          return {
            name: col.name,
            type: col.type,
            nullable: col.nullable,
            description: col.description,
          };
        }

        let sampleValues: string[] = [];
        try {
          const { data: samples } = await supabaseAdmin.rpc(
            "execute_readonly_sql",
            {
              query_text: `SELECT DISTINCT ${col.name}::text AS val FROM ${tableName} WHERE ${col.name} IS NOT NULL LIMIT 5`,
            }
          );
          if (samples) {
            sampleValues = samples.map((row: { val: string }) => {
              const v = String(row.val);
              return v.length > 100 ? v.slice(0, 97) + "..." : v;
            });
          }
        } catch {
          // Non-fatal
        }

        return {
          name: col.name,
          type: col.type,
          nullable: col.nullable,
          description: col.description,
          sample_values: sampleValues.length > 0 ? sampleValues : undefined,
        };
      })
    );

    const result = {
      table_name: meta.table_name,
      purpose: meta.purpose,
      columns: columnsWithSamples,
      row_count_estimate: rowCountEstimate,
      common_queries: meta.common_queries,
      gotchas: meta.gotchas,
      related_tables: meta.related_tables,
    };

    return {
      ok: true,
      data: result,
      summary: `Table '${tableName}': ${columnsWithSamples.length} columns, ~${rowCountEstimate} rows`,
    };
  }
);
