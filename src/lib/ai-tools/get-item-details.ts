import { supabaseAdmin } from "@/lib/supabase-admin";
import { registerTool } from "./index";
import type { ToolResult } from "./types";

registerTool(
  {
    name: "get_item_details",
    description:
      "Get full details for a single item by code or ID, including all suppliers, prices, and aliases.",
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
        error: {
          code: "BAD_INPUT",
          message: "item_code or item_id required",
        },
      };
    }

    // Find the item
    let itemQuery = supabaseAdmin.from("item").select("*");
    if (input.item_id) {
      itemQuery = itemQuery.eq("id", Number(input.item_id));
    } else {
      itemQuery = itemQuery.ilike(
        "item_code",
        String(input.item_code).trim()
      );
    }

    const { data: items, error: itemErr } = await itemQuery.limit(1);
    if (itemErr) {
      return {
        ok: false,
        error: { code: "DB_ERROR", message: itemErr.message },
      };
    }
    if (!items || items.length === 0) {
      return {
        ok: true,
        data: null,
        summary: `No item found matching ${input.item_code || input.item_id}`,
      };
    }

    const item = items[0];

    // Get suppliers with company name joined
    const { data: suppliers, error: supErr } = await supabaseAdmin
      .from("item_supplier")
      .select("id, their_item_code, price, currency, notes, last_price_update, company:company_id(id, name)")
      .eq("item_id", item.id);

    if (supErr) {
      return {
        ok: false,
        error: { code: "DB_ERROR", message: supErr.message },
      };
    }

    // Supabase types the joined company as an array; FK resolves to one row.
    type CompanyShape = { id: number; name: string };
    const result = {
      ...item,
      suppliers: (suppliers ?? []).map((s) => {
        const raw = s.company as unknown as CompanyShape | CompanyShape[] | null;
        const c = Array.isArray(raw) ? raw[0] : raw;
        return {
          supplier_id: c?.id ?? 0,
          supplier_name: c?.name ?? "Unknown",
          their_item_code: s.their_item_code,
          price: s.price,
          currency: s.currency,
          last_price_update: s.last_price_update,
          notes: s.notes,
        };
      }),
    };

    return {
      ok: true,
      data: result,
      summary: `Item ${item.item_code} with ${suppliers?.length ?? 0} suppliers`,
    };
  }
);
