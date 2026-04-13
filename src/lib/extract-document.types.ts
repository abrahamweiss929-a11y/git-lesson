// Request body sent from frontend to /api/extract-document
export interface ExtractDocumentRequest {
  file_base64: string; // base64-encoded file content (no data URI prefix)
  mime_type: string; // e.g. "image/jpeg", "application/pdf"
  file_name: string; // original filename for display/logging
}

// A single line item extracted by Claude (mapped to match form field names)
export interface ExtractedLineItem {
  item_number: string;
  quantity_boxes: number;
  lot_number: string;
  expiration_date: string | null; // ISO date string or null
}

// Successful API response
export interface ExtractDocumentResponse {
  company_match: { id: number; name: string } | null;
  company_name_raw: string | null;
  date: string | null; // ISO date string
  line_items: ExtractedLineItem[];
  confidence_notes: string;
  document_type: string;
}

// Error API response
export interface ExtractDocumentError {
  error: string;
  code:
    | "FILE_TOO_LARGE"
    | "UNSUPPORTED_TYPE"
    | "AI_ERROR"
    | "PARSE_ERROR"
    | "EMPTY_RESULT"
    | "UNKNOWN";
}
