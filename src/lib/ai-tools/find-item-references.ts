import { supabaseAdmin } from "@/lib/supabase-admin";
import { registerTool } from "./index";
import type { ToolResult } from "./types";

/**
 * Find all codes (manufacturer code + supplier aliases) for an item.
 * This is the foundation for cross-table queries — receipts, orders,
 * and usage reference items by TEXT item_number which could be any alias.
 */

export async function findItemReferences(
  itemCode?: string,
  itemId?: number
): Promise<ToolResult<{ item_id: number; item_code: string; all_codes: string[] }>> {
  if (!itemCode && !itemId) {
    return {
      ok: false,
      error: { code: "BAD_INPUT", message: "item_code or item_id required" },
    };
  }

  // Find the item
  let itemQuery = supabaseAdmin.from("item").select("id, item_code");
  if (itemId) {
    itemQuery = itemQuery.eq("id", itemId);
  } else {
    itemQuery = itemQuery.ilike("item_code", String(itemCode).trim());
  }

  const { data: items, error: itemErr } = await itemQuery.limit(1);
  if (itemErr) {
    return { ok: false, error: { code: "DB_ERROR", message: itemErr.message } };
  }
  if (!items || items.length === 0) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: `No item found matching ${itemCode || itemId}`,
      },
    };
  }

  const item = items[0];

  // Get all supplier aliases
  const { data: aliases, error: aliasErr } = await supabaseAdmin
    .from("item_supplier")
    .select("their_item_code")
    .eq("item_id", item.id)
    .not("their_item_code", "is", null);

  if (aliasErr) {
    return { ok: false, error: { code: "DB_ERROR", message: aliasErr.message } };
  }

  const allCodes = [item.item_code];
  for (const a of aliases ?? []) {
    if (a.their_item_code && !allCodes.includes(a.their_item_code)) {
      allCodes.push(a.their_item_code);
    }
  }

  return {
    ok: true,
    data: { item_id: item.id, item_code: item.item_code, all_codes: allCodes },
    summary: `Item ${item.item_code} has ${allCodes.length} code(s): ${allCodes.join(", ")}`,
  };
}

registerTool(
  {
    name: "find_item_references",
    description:
      "Given an item, return ALL the codes by which it might appear in receipts, orders, or usage (manufacturer code + all supplier aliases). Essential for cross-table lookups.",
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
    return findItemReferences(
      input.item_code ? String(input.item_code) : undefined,
      input.item_id ? Number(input.item_id) : undefined
    );
  }
);
