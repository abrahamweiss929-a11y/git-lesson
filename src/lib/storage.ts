/**
 * Supabase Storage helpers for v5 source document persistence.
 * Handles upload, delete, signed URL generation, and path building.
 */

import { supabaseAdmin } from "./supabase-admin";
import { sanitizeFilename } from "./file-validation";

const BUCKET = "source-documents";
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

/**
 * Build a storage path: {context}/{yyyy-mm}/{uuid}-{sanitized-filename}.{ext}
 */
export function buildStoragePath(
  context: "receipt" | "order",
  originalFilename: string
): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const uuid = crypto.randomUUID().slice(0, 8); // 8 chars is enough for collision avoidance
  const sanitized = sanitizeFilename(originalFilename);
  return `${context}s/${yyyy}-${mm}/${uuid}-${sanitized}`;
}

/**
 * Upload a file (as Buffer) to the source-documents bucket.
 * Returns the storage path on success.
 */
export async function uploadFile(
  storagePath: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ path: string; error?: string }> {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    return { path: storagePath, error: error.message };
  }

  return { path: storagePath };
}

/**
 * Delete a file from the source-documents bucket.
 */
export async function deleteFile(
  storagePath: string
): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (error) {
    return { error: error.message };
  }

  return {};
}

/**
 * Generate a signed URL for viewing/downloading a file.
 * URL expires after 1 hour.
 */
export async function getSignedUrl(
  storagePath: string
): Promise<{ signedUrl?: string; error?: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

  if (error || !data?.signedUrl) {
    return { error: error?.message ?? "Failed to generate signed URL" };
  }

  return { signedUrl: data.signedUrl };
}
