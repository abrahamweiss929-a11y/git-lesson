import { supabaseAdmin } from "@/lib/supabase-admin";
import { registerTool } from "./index";
import type { ToolResult } from "./types";

registerTool(
  {
    name: "list_expiring_lots",
    description:
      "Find lot numbers from receipts with expiration dates within a given number of days. Use for 'what expires soon', 'lots expiring in 60 days', etc.",
    input_schema: {
      type: "object",
      properties: {
        within_days: {
          type: "integer",
          description:
            "Number of days from today. Returns lots expiring within this window. Default 60.",
          minimum: 1,
        },
      },
      required: [],
    },
  },
  async (input): Promise<ToolResult> => {
    const withinDays = Number(input.within_days) || 60;
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const { data, error } = await supabaseAdmin
      .from("receipt_line")
      .select(
        "item_number, lot_number, expiration_date, quantity_boxes, receipt:receipt_id(date, company:company_id(name))"
      )
      .not("expiration_date", "is", null)
      .gte("expiration_date", today)
      .lte("expiration_date", cutoffStr)
      .order("expiration_date", { ascending: true })
      .limit(500);

    if (error) {
      return { ok: false, error: { code: "DB_ERROR", message: error.message } };
    }

    // Supabase types joined relations as arrays; FKs resolve to single rows at runtime.
    type ReceiptShape = { date: string; company: { name: string } | { name: string }[] };
    const rows = (data ?? [])
      .map((line) => {
        const raw = line.receipt as unknown as ReceiptShape | ReceiptShape[] | null;
        const r = Array.isArray(raw) ? raw[0] : raw;
        if (!r) return null;
        const company = Array.isArray(r.company) ? r.company[0] : r.company;
        const expDate = new Date(line.expiration_date);
        const todayDate = new Date(today);
        const daysLeft = Math.ceil(
          (expDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          item_number: line.item_number,
          lot_number: line.lot_number,
          expiration_date: line.expiration_date,
          days_until_expiry: daysLeft,
          quantity_boxes: line.quantity_boxes,
          supplier: company?.name ?? "Unknown",
          received_date: r.date,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return {
      ok: true,
      data: rows,
      summary: `Found ${rows.length} lot(s) expiring within ${withinDays} days`,
    };
  }
);
