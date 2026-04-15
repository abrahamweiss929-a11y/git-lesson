import { supabaseAdmin } from "@/lib/supabase-admin";
import { registerTool } from "./index";
import { findItemReferences } from "./find-item-references";
import type { ToolResult } from "./types";

registerTool(
  {
    name: "find_receipts_for_item",
    description:
      "Find all receipts containing a specific item. Handles alias matching automatically. Returns lot numbers and expiration dates.",
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
            "Only include receipts on or after this date (YYYY-MM-DD).",
        },
        until_date: {
          type: "string",
          description:
            "Only include receipts on or before this date (YYYY-MM-DD).",
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

    const { data, error } = await supabaseAdmin
      .from("receipt_line")
      .select(
        "id, item_number, quantity_boxes, lot_number, expiration_date, receipt:receipt_id(id, date, company:company_id(id, name))"
      )
      .in("item_number", all_codes)
      .order("id", { ascending: false })
      .limit(500);

    if (error) {
      return { ok: false, error: { code: "DB_ERROR", message: error.message } };
    }

    const rows = (data ?? [])
      .map((line) => {
        const r = line.receipt as {
          id: number;
          date: string;
          company: { id: number; name: string };
        };
        return {
          receipt_id: r.id,
          receipt_date: r.date,
          supplier: r.company.name,
          item_number: line.item_number,
          quantity_boxes: line.quantity_boxes,
          lot_number: line.lot_number,
          expiration_date: line.expiration_date,
        };
      })
      .filter((row) => {
        if (input.since_date && row.receipt_date < String(input.since_date))
          return false;
        if (input.until_date && row.receipt_date > String(input.until_date))
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.receipt_date).getTime() -
          new Date(a.receipt_date).getTime()
      );

    return {
      ok: true,
      data: rows,
      summary: `Found ${rows.length} receipt line(s) for ${item_code}`,
    };
  }
);
