import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * DELETE /api/document/[id]/detach
 * Removes the link between a source document and a receipt/order.
 * The file and source_document row are preserved.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const docId = parseInt(id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
  }

  let body: { context: string; target_id: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body. Expected { context, target_id }." },
      { status: 400 }
    );
  }

  const { context, target_id } = body;
  if (!context || !target_id) {
    return NextResponse.json(
      { error: "Missing required fields: context, target_id" },
      { status: 400 }
    );
  }

  if (context !== "receipt" && context !== "order") {
    return NextResponse.json(
      { error: 'context must be "receipt" or "order"' },
      { status: 400 }
    );
  }

  const joinTable =
    context === "receipt"
      ? "receipt_source_document"
      : "purchase_order_source_document";
  const joinColumn =
    context === "receipt" ? "receipt_id" : "purchase_order_id";

  const { error: deleteErr, count } = await supabaseAdmin
    .from(joinTable)
    .delete({ count: "exact" })
    .eq(joinColumn, target_id)
    .eq("source_document_id", docId);

  if (deleteErr) {
    return NextResponse.json(
      { error: `Failed to detach: ${deleteErr.message}` },
      { status: 500 }
    );
  }

  if (count === 0) {
    return NextResponse.json(
      { error: "No matching link found to detach." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
