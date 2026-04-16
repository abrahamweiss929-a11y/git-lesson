import { supabaseAdmin } from "@/lib/supabase-admin";
import { registerTool } from "./index";
import type { ToolResult } from "./types";

registerTool(
  {
    name: "compare_supplier_prices",
    description:
      "For a given item, compare prices across all suppliers that carry it. Returns each supplier's price, their alias code, and last update date.",
    input_schema: {
      type: "object",
      properties: {
        item_code: {
          type: "string",
          description: "The item's code (case-insensitive match).",
        },
        item_id: {
          type: "integer",
          description: "The item's database ID.",
        },
      },
      required: [],
    },
  },
  async (input): Promise<ToolResult> => {
    if (!input.item_code && !input.item_id) {
      return {
        ok: false,
        error: { code: "BAD_INPUT", message: "item_code or item_id required" },
      };
    }

    // Find the item
    let itemQuery = supabaseAdmin.from("item").select("id, item_code, item_name");
    if (input.item_id) {
      itemQuery = itemQuery.eq("id", Number(input.item_id));
    } else {
      itemQuery = itemQuery.ilike("item_code", String(input.item_code).trim());
    }

    const { data: items, error: itemErr } = await itemQuery.limit(1);
    if (itemErr) {
      return { ok: false, error: { code: "DB_ERROR", message: itemErr.message } };
    }
    if (!items || items.length === 0) {
      return {
        ok: true,
        data: [],
        summary: `No item found matching ${input.item_code || input.item_id}`,
      };
    }

    const item = items[0];

    const { data: suppliers, error: supErr } = await supabaseAdmin
      .from("item_supplier")
      .select(
        "their_item_code, price, currency, last_price_update, company:company_id(name)"
      )
      .eq("item_id", item.id)
      .order("price", { ascending: true, nullsFirst: false });

    if (supErr) {
      return { ok: false, error: { code: "DB_ERROR", message: supErr.message } };
    }

    const rows = (suppliers ?? []).map((s) => ({
      supplier_name: (s.company as { name: string }).name,
      their_item_code: s.their_item_code,
      price: s.price,
      currency: s.currency,
      last_price_update: s.last_price_update,
    }));

    return {
      ok: true,
      data: rows,
      summary: `${rows.length} suppliers carry ${item.item_code} (${item.item_name || "unnamed"})`,
    };
  }
);
