import { supabaseAdmin } from "@/lib/supabase-admin";
import { registerTool } from "./index";
import type { ToolResult } from "./types";

registerTool(
  {
    name: "list_recent_activity",
    description:
      "Show recent receipts, orders, or usage in a time window. Use for 'what happened this week', 'recent orders', etc.",
    input_schema: {
      type: "object",
      properties: {
        activity_type: {
          type: "string",
          enum: ["receipts", "orders", "usage", "all"],
          description:
            "Which type of activity to show. 'all' returns a mix of all three.",
        },
        since_date: {
          type: "string",
          description:
            "Only include activity on or after this date (YYYY-MM-DD). Defaults to 7 days ago.",
        },
        until_date: {
          type: "string",
          description:
            "Only include activity on or before this date (YYYY-MM-DD).",
        },
        limit: {
          type: "integer",
          description: "Max rows to return. Default 100, max 500.",
          minimum: 1,
          maximum: 500,
        },
      },
      required: [],
    },
  },
  async (input): Promise<ToolResult> => {
    const activityType = String(input.activity_type || "all");
    const limit = Math.min(Number(input.limit) || 100, 500);
    const defaultSince = new Date();
    defaultSince.setDate(defaultSince.getDate() - 7);
    const sinceDate =
      input.since_date
        ? String(input.since_date)
        : defaultSince.toISOString().slice(0, 10);
    const untilDate = input.until_date ? String(input.until_date) : undefined;

    const results: Array<Record<string, unknown>> = [];

    if (activityType === "receipts" || activityType === "all") {
      let q = supabaseAdmin
        .from("receipt_line")
        .select(
          "id, item_number, quantity_boxes, lot_number, expiration_date, receipt:receipt_id(id, date, company:company_id(name))"
        )
        .gte("receipt.date", sinceDate)
        .order("id", { ascending: false })
        .limit(limit);

      if (untilDate) {
        q = q.lte("receipt.date", untilDate);
      }

      const { data } = await q;
      for (const line of data ?? []) {
        const r = line.receipt as { id: number; date: string; company: { name: string } } | null;
        if (!r) continue;
        results.push({
          type: "receipt",
          date: r.date,
          supplier: r.company.name,
          item_number: line.item_number,
          quantity_boxes: line.quantity_boxes,
          lot_number: line.lot_number,
          expiration_date: line.expiration_date,
        });
      }
    }

    if (activityType === "orders" || activityType === "all") {
      let q = supabaseAdmin
        .from("purchase_order_line")
        .select(
          "id, item_number, quantity_boxes, price, purchase_order:purchase_order_id(id, date, company:company_id(name))"
        )
        .gte("purchase_order.date", sinceDate)
        .order("id", { ascending: false })
        .limit(limit);

      if (untilDate) {
        q = q.lte("purchase_order.date", untilDate);
      }

      const { data } = await q;
      for (const line of data ?? []) {
        const po = line.purchase_order as { id: number; date: string; company: { name: string } } | null;
        if (!po) continue;
        results.push({
          type: "order",
          date: po.date,
          supplier: po.company.name,
          item_number: line.item_number,
          quantity_boxes: line.quantity_boxes,
          unit_price: line.price,
        });
      }
    }

    if (activityType === "usage" || activityType === "all") {
      let q = supabaseAdmin
        .from("usage")
        .select("id, item_number, lot_number, parts_used, date")
        .gte("date", sinceDate)
        .order("date", { ascending: false })
        .limit(limit);

      if (untilDate) {
        q = q.lte("date", untilDate);
      }

      const { data } = await q;
      for (const row of data ?? []) {
        results.push({
          type: "usage",
          date: row.date,
          item_number: row.item_number,
          parts_used: row.parts_used,
          lot_number: row.lot_number,
        });
      }
    }

    // Sort by date descending
    results.sort((a, b) => {
      const da = String(a.date || "");
      const db = String(b.date || "");
      return db.localeCompare(da);
    });

    return {
      ok: true,
      data: results.slice(0, limit),
      summary: `Found ${results.length} activity records since ${sinceDate}`,
    };
  }
);
