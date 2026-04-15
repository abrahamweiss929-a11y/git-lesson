import { supabaseAdmin } from "@/lib/supabase-admin";
import { registerTool } from "./index";
import { findItemReferences } from "./find-item-references";
import type { ToolResult } from "./types";

registerTool(
  {
    name: "find_orders_for_item",
    description:
      "Find all purchase orders containing a specific item. Handles alias matching automatically (manufacturer code + supplier aliases).",
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
          description: "Only include orders on or after this date (YYYY-MM-DD).",
        },
        until_date: {
          type: "string",
          description: "Only include orders on or before this date (YYYY-MM-DD).",
        },
      },
      required: [],
    },
  },
  async (input): Promise<ToolResult> => {
    // Get all codes for this item
    const refs = await findItemReferences(
      input.item_code ? String(input.item_code) : undefined,
      input.item_id ? Number(input.item_id) : undefined
    );
    if (!refs.ok) return refs;

    const { all_codes, item_code } = refs.data;

    // Build query: find order lines matching any of the codes
    let query = supabaseAdmin
      .from("purchase_order_line")
      .select(
        "id, item_number, quantity_boxes, price, purchase_order:purchase_order_id(id, date, company:company_id(id, name))"
      )
      .in("item_number", all_codes)
      .order("id", { ascending: false })
      .limit(500);

    const { data, error } = await query;
    if (error) {
      return { ok: false, error: { code: "DB_ERROR", message: error.message } };
    }

    // Flatten the joined data and apply date filters
    const rows = (data ?? [])
      .map((line) => {
        const po = line.purchase_order as {
          id: number;
          date: string;
          company: { id: number; name: string };
        };
        return {
          order_id: po.id,
          order_date: po.date,
          supplier: po.company.name,
          item_number: line.item_number,
          quantity_boxes: line.quantity_boxes,
          unit_price: line.price,
          line_total:
            line.price != null
              ? Number(line.price) * line.quantity_boxes
              : null,
        };
      })
      .filter((row) => {
        if (input.since_date && row.order_date < String(input.since_date))
          return false;
        if (input.until_date && row.order_date > String(input.until_date))
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
      );

    return {
      ok: true,
      data: rows,
      summary: `Found ${rows.length} order line(s) for ${item_code}`,
    };
  }
);
