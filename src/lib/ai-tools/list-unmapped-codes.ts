import { supabaseAdmin } from "@/lib/supabase-admin";
import { registerTool } from "./index";
import type { ToolResult } from "./types";

registerTool(
  {
    name: "list_unmapped_codes",
    description:
      "Data quality check. Find item_numbers in receipts/orders/usage that don't match any known item code or supplier alias. These are codes that appear in transactions but aren't in the catalog.",
    input_schema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          enum: ["receipts", "orders", "usage", "all"],
          description:
            "Which table(s) to check. Default 'all'.",
        },
      },
      required: [],
    },
  },
  async (input): Promise<ToolResult> => {
    const source = String(input.source || "all");

    // Get all known codes: item.item_code + item_supplier.their_item_code
    const { data: items } = await supabaseAdmin
      .from("item")
      .select("item_code");
    const { data: aliases } = await supabaseAdmin
      .from("item_supplier")
      .select("their_item_code")
      .not("their_item_code", "is", null);

    const knownCodes = new Set<string>();
    for (const item of items ?? []) {
      knownCodes.add(item.item_code.toLowerCase().trim());
    }
    for (const alias of aliases ?? []) {
      if (alias.their_item_code) {
        knownCodes.add(alias.their_item_code.toLowerCase().trim());
      }
    }

    const unmapped: Array<{
      item_number: string;
      source: string;
      count: number;
    }> = [];

    async function checkSource(
      table: string,
      sourceLabel: string
    ) {
      const { data } = await supabaseAdmin
        .from(table)
        .select("item_number")
        .limit(10000);

      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        const code = String(row.item_number).toLowerCase().trim();
        if (!knownCodes.has(code)) {
          counts.set(
            row.item_number,
            (counts.get(row.item_number) || 0) + 1
          );
        }
      }

      for (const [code, count] of counts) {
        unmapped.push({ item_number: code, source: sourceLabel, count });
      }
    }

    if (source === "receipts" || source === "all") {
      await checkSource("receipt_line", "receipts");
    }
    if (source === "orders" || source === "all") {
      await checkSource("purchase_order_line", "orders");
    }
    if (source === "usage" || source === "all") {
      await checkSource("usage", "usage");
    }

    // Sort by count descending
    unmapped.sort((a, b) => b.count - a.count);

    return {
      ok: true,
      data: unmapped,
      summary: `Found ${unmapped.length} unmapped code(s) across ${source}`,
    };
  }
);
