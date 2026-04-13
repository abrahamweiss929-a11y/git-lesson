import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { supabase } from "@/lib/supabase";
import { findBestCompanyMatch } from "@/lib/fuzzy-match";
import type {
  ExtractDocumentRequest,
  ExtractDocumentResponse,
  ExtractDocumentError,
} from "@/lib/extract-document.types";

export const maxDuration = 60;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_PIXELS = 3_750_000; // 3.75 MP
const MAX_EDGE = 1568;

const SYSTEM_PROMPT = `You are a data extraction assistant for a laboratory inventory management system.
You will receive a document (invoice, packing slip, receipt, or purchase order)
and must extract structured data about the items being received or ordered.

Return your response as a single valid JSON object with this exact shape, and
NOTHING else — no prose, no markdown code blocks, no explanation:

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
  or that you had to guess. Empty string if everything was clear.

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
): Promise<NextResponse<ExtractDocumentResponse | ExtractDocumentError>> {
  try {
    const body: ExtractDocumentRequest = await request.json();
    const { file_base64, mime_type, file_name } = body;

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(mime_type)) {
      return errorResponse(
        `Unsupported file type: ${mime_type}. Allowed: JPG, PNG, WebP, PDF.`,
        "UNSUPPORTED_TYPE",
        400
      );
    }

    // Decode base64 and validate size
    const buffer = Buffer.from(file_base64, "base64");
    if (buffer.length > MAX_FILE_SIZE) {
      return errorResponse(
        "File too large (max 10 MB).",
        "FILE_TOO_LARGE",
        400
      );
    }

    // Resize large images (not PDFs)
    let processedBase64 = file_base64;
    let processedMimeType = mime_type;
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
        // Keep original mime type
      }
    }

    // Call Claude
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
      system: SYSTEM_PROMPT,
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
      return errorResponse(
        "AI returned no text response.",
        "AI_ERROR",
        500
      );
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
      }>;
      confidence_notes?: string;
    };

    try {
      parsed = JSON.parse(rawText);
    } catch {
      return errorResponse(
        "Failed to parse AI response as JSON. Please fill the form manually.",
        "PARSE_ERROR",
        500
      );
    }

    if (!parsed.line_items || !Array.isArray(parsed.line_items)) {
      return errorResponse(
        "AI response missing line_items. Please fill the form manually.",
        "PARSE_ERROR",
        500
      );
    }

    // Map AI field names to form field names
    const lineItems = parsed.line_items.map((item) => {
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
    };

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unknown error occurred.";
    return errorResponse(
      `Extraction failed: ${message}`,
      "UNKNOWN",
      500
    );
  }
}
