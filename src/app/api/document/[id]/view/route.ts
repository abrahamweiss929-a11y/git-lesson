import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSignedUrl } from "@/lib/storage";

/**
 * GET /api/document/[id]/view
 * Generates a signed URL for the source document and redirects to it.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const docId = parseInt(id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
  }

  const { data: doc, error: docErr } = await supabaseAdmin
    .from("source_document")
    .select("storage_path, mime_type")
    .eq("id", docId)
    .single();

  if (docErr || !doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const { signedUrl, error: urlErr } = await getSignedUrl(doc.storage_path);
  if (urlErr || !signedUrl) {
    return NextResponse.json(
      { error: `Failed to generate URL: ${urlErr ?? "Unknown error"}` },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signedUrl, 302);
}
