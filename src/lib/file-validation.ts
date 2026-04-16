/**
 * File validation for v5 source document uploads.
 * Triple-checks: magic bytes + file extension + MIME type must all agree.
 * Also handles filename sanitization and size enforcement.
 */

// 25 MB size cap (enforced on decoded binary, not base64)
export const MAX_FILE_SIZE = 25 * 1024 * 1024;

// Allowed file types with their magic bytes, extensions, and MIME types
const FILE_SIGNATURES: {
  mime: string;
  extensions: string[];
  check: (bytes: Uint8Array) => boolean;
}[] = [
  {
    mime: "application/pdf",
    extensions: [".pdf"],
    // PDF: starts with %PDF (0x25 0x50 0x44 0x46)
    check: (b) =>
      b.length >= 4 &&
      b[0] === 0x25 &&
      b[1] === 0x50 &&
      b[2] === 0x44 &&
      b[3] === 0x46,
  },
  {
    mime: "image/png",
    extensions: [".png"],
    // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
    check: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: "image/jpeg",
    extensions: [".jpg", ".jpeg"],
    // JPEG: starts with FF D8 FF
    check: (b) =>
      b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/webp",
    extensions: [".webp"],
    // WebP: starts with RIFF (52 49 46 46) and bytes 8-11 are WEBP
    check: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
];

const ALLOWED_MIMES = FILE_SIGNATURES.map((s) => s.mime);
const ALLOWED_EXTENSIONS = FILE_SIGNATURES.flatMap((s) => s.extensions);

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMime?: string;
}

/**
 * Validate a file by checking magic bytes, extension, and MIME type.
 * All three must agree. Returns { valid: true } or { valid: false, error }.
 */
export function validateFile(
  bytes: Uint8Array,
  fileName: string,
  claimedMime: string
): FileValidationResult {
  // 1. Size check
  if (bytes.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large (${(bytes.length / 1024 / 1024).toFixed(1)} MB). Maximum is 25 MB.`,
    };
  }

  // 2. Extension check
  const ext = getExtension(fileName);
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file extension: "${ext || "(none)"}". Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    };
  }

  // 3. MIME type check
  if (!ALLOWED_MIMES.includes(claimedMime)) {
    return {
      valid: false,
      error: `Unsupported MIME type: "${claimedMime}". Allowed: ${ALLOWED_MIMES.join(", ")}`,
    };
  }

  // 4. Magic byte check — find which signature matches
  const magicMatch = FILE_SIGNATURES.find((sig) => sig.check(bytes));
  if (!magicMatch) {
    return {
      valid: false,
      error:
        "File content does not match any supported format. The file may be corrupted or mislabeled.",
    };
  }

  // 5. All three must agree
  // The magic-byte-detected MIME must match the claimed MIME
  if (magicMatch.mime !== claimedMime) {
    return {
      valid: false,
      error: `File content is ${magicMatch.mime} but was sent as "${claimedMime}". File type mismatch.`,
    };
  }

  // The extension must be valid for the detected type
  if (!magicMatch.extensions.includes(ext)) {
    return {
      valid: false,
      error: `File extension "${ext}" does not match file content (${magicMatch.mime}).`,
    };
  }

  return { valid: true, detectedMime: magicMatch.mime };
}

/**
 * Extract lowercase extension from filename (including the dot).
 */
function getExtension(fileName: string): string | null {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1 || lastDot === fileName.length - 1) return null;
  return fileName.slice(lastDot).toLowerCase();
}

/**
 * Sanitize a filename for safe storage:
 * - Strip path separators (/ and \)
 * - Strip special chars except _, -, ., alphanumeric
 * - Collapse multiple underscores
 * - Lowercase extension
 * - Max 200 chars total
 */
export function sanitizeFilename(fileName: string): string {
  // Strip path separators
  let name = fileName.replace(/[/\\]/g, "");

  // Split into name + extension
  const lastDot = name.lastIndexOf(".");
  let baseName = lastDot > 0 ? name.slice(0, lastDot) : name;
  let ext = lastDot > 0 ? name.slice(lastDot).toLowerCase() : "";

  // Strip special chars from base name (keep alphanumeric, _, -, space)
  baseName = baseName.replace(/[^a-zA-Z0-9_\- ]/g, "");

  // Replace spaces with underscores
  baseName = baseName.replace(/\s+/g, "_");

  // Collapse multiple underscores
  baseName = baseName.replace(/_+/g, "_");

  // Trim leading/trailing underscores
  baseName = baseName.replace(/^_+|_+$/g, "");

  // Fallback if name is empty after sanitization
  if (!baseName) baseName = "document";

  // Truncate to fit within 200 chars total
  const maxBase = 200 - ext.length;
  if (baseName.length > maxBase) {
    baseName = baseName.slice(0, maxBase);
  }

  return baseName + ext;
}
