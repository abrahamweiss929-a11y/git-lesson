import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { deleteFile } from "@/lib/storage";

/**
 * DELETE /api/document/[id]
 * Deletes a source_document and its file from Storage.
 * Blocks if any receipts/orders still reference it (409 Conflict).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const docId = parseInt(id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
  }

  // Check the document exists
  const { data: doc, error: docErr } = await supabaseAdmin
    .from("source_document")
    .select("id, storage_path")
    .eq("id", docId)
    .single();

  if (docErr || !doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  // Check for existing links in receipt_source_document
  const { count: receiptLinks } = await supabaseAdmin
    .from("receipt_source_document")
    .select("id", { count: "exact", head: true })
    .eq("source_document_id", docId);

  // Check for existing links in purchase_order_source_document
  const { count: orderLinks } = await supabaseAdmin
    .from("purchase_order_source_document")
    .select("id", { count: "exact", head: true })
    .eq("source_document_id", docId);

  const totalLinks = (receiptLinks ?? 0) + (orderLinks ?? 0);
  if (totalLinks > 0) {
    return NextResponse.json(
      {
        error: `This document is still attached to ${totalLinks} receipt${totalLinks !== 1 ? "s" : ""}/order${totalLinks !== 1 ? "s" : ""}. Detach it first.`,
      },
      { status: 409 }
    );
  }

  // Delete from Storage
  const { error: storageErr } = await deleteFile(doc.storage_path);
  if (storageErr) {
    return NextResponse.json(
      { error: `Failed to delete file from storage: ${storageErr}` },
      { status: 500 }
    );
  }

  // Delete from database
  const { error: deleteErr } = await supabaseAdmin
    .from("source_document")
    .delete()
    .eq("id", docId);

  if (deleteErr) {
    return NextResponse.json(
      { error: `Failed to delete record: ${deleteErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
