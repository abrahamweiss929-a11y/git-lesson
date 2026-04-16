import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateFile } from "@/lib/file-validation";
import { buildStoragePath, uploadFile, deleteFile } from "@/lib/storage";
import { createRateLimiter } from "@/lib/rate-limit";

export const maxDuration = 60;

// Rate limit: 10 uploads per minute per IP
const rateLimiter = createRateLimiter(10);

interface AttachRequest {
  file_base64: string;
  mime_type: string;
  file_name: string;
  context: "receipt" | "order";
  target_id: number;
}

export async function POST(request: NextRequest) {
  // Rate limit
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateCheck = rateLimiter.check(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds ?? 60) },
      }
    );
  }

  try {
    const body: AttachRequest = await request.json();
    const { file_base64, mime_type, file_name, context, target_id } = body;

    if (!file_base64 || !mime_type || !file_name || !context || !target_id) {
      return NextResponse.json(
        { error: "Missing required fields: file_base64, mime_type, file_name, context, target_id" },
        { status: 400 }
      );
    }

    if (context !== "receipt" && context !== "order") {
      return NextResponse.json(
        { error: 'context must be "receipt" or "order"' },
        { status: 400 }
      );
    }

    // Verify target exists
    const table = context === "receipt" ? "receipt" : "purchase_order";
    const { data: target, error: targetErr } = await supabaseAdmin
      .from(table)
      .select("id")
      .eq("id", target_id)
      .single();

    if (targetErr || !target) {
      return NextResponse.json(
        { error: `${context === "receipt" ? "Receipt" : "Order"} #${target_id} not found.` },
        { status: 404 }
      );
    }

    // Decode and validate file
    const buffer = Buffer.from(file_base64, "base64");
    const bytes = new Uint8Array(buffer);
    const validation = validateFile(bytes, file_name, mime_type);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Upload to Storage
    const storagePath = buildStoragePath(context, file_name);
    const uploadResult = await uploadFile(storagePath, buffer, mime_type);
    if (uploadResult.error) {
      return NextResponse.json(
        { error: `Failed to save file: ${uploadResult.error}` },
        { status: 500 }
      );
    }

    // Insert source_document row
    const { data: sourceDoc, error: sourceDocErr } = await supabaseAdmin
      .from("source_document")
      .insert({
        storage_path: storagePath,
        original_filename: file_name,
        mime_type,
        size_bytes: buffer.length,
        uploaded_via: "manual_attach",
        context,
      })
      .select("id, original_filename, size_bytes")
      .single();

    if (sourceDocErr || !sourceDoc) {
      // Best-effort cleanup
      await deleteFile(storagePath);
      return NextResponse.json(
        { error: `Failed to record file: ${sourceDocErr?.message ?? "Unknown error"}` },
        { status: 500 }
      );
    }

    // Insert join row to link document to target
    const joinTable =
      context === "receipt"
        ? "receipt_source_document"
        : "purchase_order_source_document";
    const joinColumn =
      context === "receipt" ? "receipt_id" : "purchase_order_id";

    const { error: joinErr } = await supabaseAdmin.from(joinTable).insert({
      [joinColumn]: target_id,
      source_document_id: sourceDoc.id,
    });

    if (joinErr) {
      return NextResponse.json(
        { error: `File saved but failed to link: ${joinErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      source_document_id: sourceDoc.id,
      original_filename: sourceDoc.original_filename,
      size_bytes: sourceDoc.size_bytes,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unknown error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
