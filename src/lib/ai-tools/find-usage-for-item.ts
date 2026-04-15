import { supabaseAdmin } from "@/lib/supabase-admin";
import { registerTool } from "./index";
import { findItemReferences } from "./find-item-references";
import type { ToolResult } from "./types";

registerTool(
  {
    name: "find_usage_for_item",
    description:
      "Find all usage records for a specific item. Handles alias matching automatically.",
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
        since_date: {
          type: "string",
          description:
            "Only include usage on or after this date (YYYY-MM-DD).",
        },
        until_date: {
          type: "string",
          description:
            "Only include usage on or before this date (YYYY-MM-DD).",
        },
      },
      required: [],
    },
  },
  async (input): Promise<ToolResult> => {
    const refs = await findItemReferences(
      input.item_code ? String(input.item_code) : undefined,
      input.item_id ? Number(input.item_id) : undefined
    );
    if (!refs.ok) return refs;

    const { all_codes, item_code } = refs.data;

    let query = supabaseAdmin
      .from("usage")
      .select("id, item_number, lot_number, parts_used, date")
      .in("item_number", all_codes)
      .order("date", { ascending: false })
      .limit(500);

    const { data, error } = await query;
    if (error) {
      return { ok: false, error: { code: "DB_ERROR", message: error.message } };
    }

    const rows = (data ?? []).filter((row) => {
      if (input.since_date && row.date < String(input.since_date)) return false;
      if (input.until_date && row.date > String(input.until_date)) return false;
      return true;
    });

    return {
      ok: true,
      data: rows,
      summary: `Found ${rows.length} usage record(s) for ${item_code}`,
    };
  }
);
