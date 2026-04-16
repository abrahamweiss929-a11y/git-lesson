import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { findBestCompanyMatch } from "@/lib/fuzzy-match";
import { validateFile, MAX_FILE_SIZE } from "@/lib/file-validation";
import { buildStoragePath, uploadFile, deleteFile } from "@/lib/storage";
import { createRateLimiter } from "@/lib/rate-limit";
import type {
  ExtractDocumentRequest,
  ExtractDocumentResponse,
  ExtractDocumentError,
} from "@/lib/extract-document.types";

export const maxDuration = 60;

const MAX_PIXELS = 3_750_000; // 3.75 MP
const MAX_EDGE = 1568;

// Rate limit: 10 uploads per minute per IP
const rateLimiter = createRateLimiter(10);

const SYSTEM_PROMPT_SHARED_PREFIX = `You are a data extraction assistant for a laboratory inventory management system.
You will receive a document (invoice, packing slip, receipt, or purchase order)
and must extract structured data about the items being received or ordered.

Return your response as a single valid JSON object with this exact shape, and
NOTHING else — no prose, no markdown code blocks, no explanation:`;

const RECEIPT_SCHEMA = `
{
  "document_type": "invoice" | "packing_slip" | "receipt" | "purchase_order" | "unknown",
  "company_name": string or null,
  "date": "YYYY-MM-DD" or null,
  "line_items": [
    {
      "item_number": string,
      "qty": number,
      "lot_number": string or null,
      "expiration": "YYYY-MM-DD" or null
    }
  ],
  "confidence_notes": string
}

FIELD GUIDANCE:
- company_name: The supplier/vendor selling the items, NOT the buyer/lab
- date: Invoice date or ship date, not due date. Format as YYYY-MM-DD.
- item_number: The supplier's catalog/SKU/part number. May be labeled
  "Item #", "Catalog #", "Product Code", "SKU", "Part Number", "Ref"
- qty: The quantity received or ordered. Must be a number, not a string.
- lot_number: The manufacturing lot or batch number. May be labeled
  "Lot", "Lot #", "Batch", "LOT", "L#". Lot numbers are per-line-item,
  not per-invoice. If not shown, use null.
- expiration: The item's expiration or "use by" date. May be labeled
  "Exp", "Expiration", "Use By", "Best By". Format YYYY-MM-DD. If not
  shown, use null.
- confidence_notes: Briefly note anything unclear, partially obscured,
  or that you had to guess. Empty string if everything was clear.`;

const ORDER_SCHEMA = `
{
  "document_type": "invoice" | "packing_slip" | "receipt" | "purchase_order" | "unknown",
  "company_name": string or null,
  "date": "YYYY-MM-DD" or null,
  "line_items": [
    {
      "item_number": string,
      "qty": number,
      "unit_price": number or null
    }
  ],
  "confidence_notes": string
}

FIELD GUIDANCE:
- company_name: The supplier/vendor selling the items, NOT the buyer/lab
- date: Order date, invoice date, or ship date, not due date. Format as YYYY-MM-DD.
- item_number: The supplier's catalog/SKU/part number. May be labeled
  "Item #", "Catalog #", "Product Code", "SKU", "Part Number", "Ref"
- qty: The quantity ordered. Must be a number, not a string.
- unit_price: The price per unit/box. May be labeled "Unit Price", "Price",
  "Cost", "Each", "Rate", "Unit Cost". Use the per-unit amount, NOT the
  extended/line total. If only the line total is shown and qty > 1, divide
  to get the unit price. If not shown, use null.
- confidence_notes: Briefly note anything unclear, partially obscured,
  or that you had to guess. Empty string if everything was clear.`;

const SHARED_RULES = `

RULES:
- If the document has multiple pages or sections, extract ALL line items
- If the same item appears on multiple lines (e.g., different lots of the
  same product), create a separate line_items entry for each
- If you cannot read a field clearly, use null rather than guessing
- Dates in MM/DD/YYYY or DD/MM/YYYY format: convert to YYYY-MM-DD. If
  ambiguous (e.g., 03/04/2026), use context clues or note it in
  confidence_notes
- Do NOT extract items that are marked as "out of stock", "cancelled",
  or "backordered" — only items actually being shipped/ordered
- Do NOT include shipping fees, taxes, or discount lines as line items`;

function buildSystemPrompt(context: "receipt" | "order"): string {
  const schema = context === "order" ? ORDER_SCHEMA : RECEIPT_SCHEMA;
  return SYSTEM_PROMPT_SHARED_PREFIX + schema + SHARED_RULES;
}

const USER_MESSAGE =
  "Extract the inventory data from this document following the schema in your instructions. Return only the JSON object.";

function errorResponse(
  error: string,
  code: ExtractDocumentError["code"],
  status: number
): NextResponse<ExtractDocumentError> {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ExtractDocumentResponse | ExtractDocumentError | { error: string }>> {
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
    const body: ExtractDocumentRequest = await request.json();
    const { file_base64, mime_type, file_name, context = "receipt" } = body;

    // Decode base64
    const buffer = Buffer.from(file_base64, "base64");
    const bytes = new Uint8Array(buffer);

    // v5: Triple-check file validation (magic bytes + extension + mime)
    const validation = validateFile(bytes, file_name, mime_type);
    if (!validation.valid) {
      return errorResponse(
        validation.error!,
        bytes.length > MAX_FILE_SIZE ? "FILE_TOO_LARGE" : "UNSUPPORTED_TYPE",
        400
      );
    }

    // v5: Upload file to Supabase Storage
    const storagePath = buildStoragePath(context, file_name);
    const uploadResult = await uploadFile(storagePath, buffer, mime_type);
    if (uploadResult.error) {
      return errorResponse(
        `Failed to save file: ${uploadResult.error}`,
        "UNKNOWN",
        500
      );
    }

    // v5: Insert source_document row
    const { data: sourceDoc, error: sourceDocErr } = await supabaseAdmin
      .from("source_document")
      .insert({
        storage_path: storagePath,
        original_filename: file_name,
        mime_type,
        size_bytes: buffer.length,
        uploaded_via: `${context}_extraction`,
        context,
      })
      .select("id")
      .single();

    if (sourceDocErr || !sourceDoc) {
      // Best-effort cleanup: delete the uploaded file
      await deleteFile(storagePath);
      return errorResponse(
        `Failed to record file metadata: ${sourceDocErr?.message ?? "Unknown error"}`,
        "UNKNOWN",
        500
      );
    }

    const sourceDocumentId: number = sourceDoc.id;

    // Resize large images for Claude (not PDFs) — same as before
    let processedBase64 = file_base64;
    const processedMimeType = mime_type;
    if (mime_type !== "application/pdf") {
      const metadata = await sharp(buffer).metadata();
      const w = metadata.width ?? 0;
      const h = metadata.height ?? 0;
      if (w * h > MAX_PIXELS) {
        const longer = Math.max(w, h);
        const scale = MAX_EDGE / longer;
        const resized = await sharp(buffer)
          .resize({
            width: Math.round(w * scale),
            height: Math.round(h * scale),
            fit: "inside",
          })
          .toBuffer();
        processedBase64 = resized.toString("base64");
      }
    }

    // Call Claude for extraction
    // v5: If extraction fails, return 200 with extraction_failed: true
    try {
      const anthropic = new Anthropic();

      const contentBlock =
        processedMimeType === "application/pdf"
          ? {
              type: "document" as const,
              source: {
                type: "base64" as const,
                media_type: "application/pdf" as const,
                data: processedBase64,
              },
            }
          : {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: processedMimeType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/webp",
                data: processedBase64,
              },
            };

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: buildSystemPrompt(context),
        messages: [
          {
            role: "user",
            content: [contentBlock, { type: "text", text: USER_MESSAGE }],
          },
        ],
      });

      // Extract text from response
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        // Extraction failed — return 200 with extraction_failed
        return NextResponse.json({
          company_match: null,
          company_name_raw: null,
          date: null,
          line_items: [],
          confidence_notes: "",
          document_type: "unknown",
          source_document_id: sourceDocumentId,
          extraction_failed: true,
          error_message: "AI returned no text response. Please fill the form manually.",
        });
      }

      // Parse JSON — strip markdown code fences if present
      let rawText = textBlock.text.trim();
      const fenceMatch = rawText.match(
        /^\s*```(?:json)?\s*\n?([\s\S]*?)\n?\s*```\s*$/
      );
      if (fenceMatch) {
        rawText = fenceMatch[1].trim();
      }

      let parsed: {
        document_type?: string;
        company_name?: string | null;
        date?: string | null;
        line_items?: Array<{
          item_number?: string;
          qty?: number;
          lot_number?: string | null;
          expiration?: string | null;
          unit_price?: number | null;
        }>;
        confidence_notes?: string;
      };

      try {
        parsed = JSON.parse(rawText);
      } catch {
        // Parse failed — return 200 with extraction_failed
        return NextResponse.json({
          company_match: null,
          company_name_raw: null,
          date: null,
          line_items: [],
          confidence_notes: "",
          document_type: "unknown",
          source_document_id: sourceDocumentId,
          extraction_failed: true,
          error_message: "Failed to parse AI response. Please fill the form manually.",
        });
      }

      if (!parsed.line_items || !Array.isArray(parsed.line_items)) {
        return NextResponse.json({
          company_match: null,
          company_name_raw: null,
          date: null,
          line_items: [],
          confidence_notes: "",
          document_type: "unknown",
          source_document_id: sourceDocumentId,
          extraction_failed: true,
          error_message: "AI response missing line items. Please fill the form manually.",
        });
      }

      // Map AI field names to form field names (context-dependent)
      const lineItems =
        context === "order"
          ? parsed.line_items.map((item) => {
              const qty = Number(item.qty);
              const price =
                item.unit_price != null ? Number(item.unit_price) : null;
              return {
                item_number: String(item.item_number ?? ""),
                quantity_boxes: Number.isFinite(qty) ? qty : 0,
                price:
                  price != null && Number.isFinite(price) ? price : null,
              };
            })
          : parsed.line_items.map((item) => {
              const qty = Number(item.qty);
              return {
                item_number: String(item.item_number ?? ""),
                quantity_boxes: Number.isFinite(qty) ? qty : 0,
                lot_number: String(item.lot_number ?? ""),
                expiration_date: item.expiration ?? null,
              };
            });

      // Fuzzy-match company
      let companyMatch: { id: number; name: string } | null = null;
      const companyNameRaw = parsed.company_name ?? null;

      if (companyNameRaw) {
        const { data: companies } = await supabase
          .from("company")
          .select("id, name");
        if (companies) {
          const result = findBestCompanyMatch(companyNameRaw, companies);
          if (result) {
            companyMatch = result.match;
          }
        }
      }

      const result: ExtractDocumentResponse = {
        company_match: companyMatch,
        company_name_raw: companyNameRaw,
        date: parsed.date ?? null,
        line_items: lineItems,
        confidence_notes: parsed.confidence_notes ?? "",
        document_type: parsed.document_type ?? "unknown",
        source_document_id: sourceDocumentId,
      };

      return NextResponse.json(result);
    } catch (extractionErr) {
      // AI extraction failed — file is saved, return 200 with extraction_failed
      const message =
        extractionErr instanceof Error
          ? extractionErr.message
          : "An unknown extraction error occurred.";
      return NextResponse.json({
        company_match: null,
        company_name_raw: null,
        date: null,
        line_items: [],
        confidence_notes: "",
        document_type: "unknown",
        source_document_id: sourceDocumentId,
        extraction_failed: true,
        error_message: `Extraction failed: ${message}. File saved — please fill the form manually.`,
      });
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unknown error occurred.";
    return errorResponse(
      `Request failed: ${message}`,
      "UNKNOWN",
      500
    );
  }
}
