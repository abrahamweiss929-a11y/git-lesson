import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/document/list?table=receipt_source_document&column=receipt_id&target_id=42
 * Returns the source documents linked to a specific receipt or order.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const table = searchParams.get("table");
  const column = searchParams.get("column");
  const targetId = searchParams.get("target_id");

  // Validate params (whitelist table/column to prevent injection)
  const ALLOWED = {
    receipt_source_document: "receipt_id",
    purchase_order_source_document: "purchase_order_id",
  } as const;

  if (
    !table ||
    !column ||
    !targetId ||
    !(table in ALLOWED) ||
    ALLOWED[table as keyof typeof ALLOWED] !== column
  ) {
    return NextResponse.json({ error: "Invalid parameters." }, { status: 400 });
  }

  const id = parseInt(targetId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid target_id." }, { status: 400 });
  }

  // Query join table → source_document
  const { data: links, error: linksErr } = await supabaseAdmin
    .from(table)
    .select("source_document_id")
    .eq(column, id);

  if (linksErr) {
    return NextResponse.json(
      { error: linksErr.message },
      { status: 500 }
    );
  }

  if (!links || links.length === 0) {
    return NextResponse.json({ files: [] });
  }

  const docIds = links.map((l: { source_document_id: number }) => l.source_document_id);
  const { data: docs, error: docsErr } = await supabaseAdmin
    .from("source_document")
    .select("id, original_filename, size_bytes, uploaded_at, uploaded_via, mime_type")
    .in("id", docIds)
    .order("uploaded_at", { ascending: false });

  if (docsErr) {
    return NextResponse.json({ error: docsErr.message }, { status: 500 });
  }

  return NextResponse.json({ files: docs ?? [] });
}
