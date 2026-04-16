import { supabaseAdmin } from "@/lib/supabase-admin";
import { registerTool } from "./index";
import { findItemReferences } from "./find-item-references";
import type { ToolResult } from "./types";

registerTool(
  {
    name: "get_source_documents_for_item",
    description:
      "Find all source documents (invoices, POs, packing slips) linked to receipts or orders that contain a given item. Returns file info and what it's linked to.",
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
    const refs = await findItemReferences(
      input.item_code ? String(input.item_code) : undefined,
      input.item_id ? Number(input.item_id) : undefined
    );
    if (!refs.ok) return refs;

    const { all_codes, item_code } = refs.data;

    // Find receipts containing this item
    const { data: receiptLines } = await supabaseAdmin
      .from("receipt_line")
      .select("receipt_id")
      .in("item_number", all_codes);

    const receiptIds = [
      ...new Set((receiptLines ?? []).map((l: { receipt_id: number }) => l.receipt_id)),
    ];

    // Find orders containing this item
    const { data: orderLines } = await supabaseAdmin
      .from("purchase_order_line")
      .select("purchase_order_id")
      .in("item_number", all_codes);

    const orderIds = [
      ...new Set(
        (orderLines ?? []).map((l: { purchase_order_id: number }) => l.purchase_order_id)
      ),
    ];

    const results: Array<{
      source_document_id: number;
      original_filename: string;
      uploaded_at: string;
      mime_type: string;
      context: string;
      linked_to: { type: string; id: number; date: string };
    }> = [];

    // Get source documents linked to these receipts
    if (receiptIds.length > 0) {
      const { data: receiptDocs } = await supabaseAdmin
        .from("receipt_source_document")
        .select(
          "source_document_id, receipt:receipt_id(id, date), source_document:source_document_id(id, original_filename, uploaded_at, mime_type, context)"
        )
        .in("receipt_id", receiptIds);

      // Supabase types joined relations as arrays; FKs resolve to single rows at runtime.
      type DocShape = { id: number; original_filename: string; uploaded_at: string; mime_type: string; context: string };
      type ReceiptShape = { id: number; date: string };
      for (const row of receiptDocs ?? []) {
        const rawDoc = row.source_document as unknown as DocShape | DocShape[] | null;
        const doc = Array.isArray(rawDoc) ? rawDoc[0] : rawDoc;
        const rawReceipt = row.receipt as unknown as ReceiptShape | ReceiptShape[] | null;
        const receipt = Array.isArray(rawReceipt) ? rawReceipt[0] : rawReceipt;
        if (doc && receipt) {
          results.push({
            source_document_id: doc.id,
            original_filename: doc.original_filename,
            uploaded_at: doc.uploaded_at,
            mime_type: doc.mime_type,
            context: doc.context,
            linked_to: { type: "receipt", id: receipt.id, date: receipt.date },
          });
        }
      }
    }

    // Get source documents linked to these orders
    if (orderIds.length > 0) {
      const { data: orderDocs } = await supabaseAdmin
        .from("purchase_order_source_document")
        .select(
          "source_document_id, purchase_order:purchase_order_id(id, date), source_document:source_document_id(id, original_filename, uploaded_at, mime_type, context)"
        )
        .in("purchase_order_id", orderIds);

      type OrderDocShape = { id: number; original_filename: string; uploaded_at: string; mime_type: string; context: string };
      type OrderShape = { id: number; date: string };
      for (const row of orderDocs ?? []) {
        const rawDoc = row.source_document as unknown as OrderDocShape | OrderDocShape[] | null;
        const doc = Array.isArray(rawDoc) ? rawDoc[0] : rawDoc;
        const rawOrder = row.purchase_order as unknown as OrderShape | OrderShape[] | null;
        const order = Array.isArray(rawOrder) ? rawOrder[0] : rawOrder;
        if (doc && order) {
          results.push({
            source_document_id: doc.id,
            original_filename: doc.original_filename,
            uploaded_at: doc.uploaded_at,
            mime_type: doc.mime_type,
            context: doc.context,
            linked_to: { type: "order", id: order.id, date: order.date },
          });
        }
      }
    }

    // Deduplicate by source_document_id (a doc may be linked to multiple receipts)
    const seen = new Set<number>();
    const unique = results.filter((r) => {
      const key = r.source_document_id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      ok: true,
      data: unique,
      summary: `Found ${unique.length} source document(s) for ${item_code}`,
    };
  }
);
