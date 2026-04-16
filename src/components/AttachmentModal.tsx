"use client";

import { useEffect, useState, useRef } from "react";

interface AttachedFile {
  id: number;
  original_filename: string;
  size_bytes: number;
  uploaded_at: string;
  uploaded_via: string;
  mime_type: string;
}

interface AttachmentModalProps {
  targetId: number;
  context: "receipt" | "order";
  label: string; // e.g. "Receipt #42" or "Order #17"
  onClose: () => void;
}

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
const ACCEPT_STRING = ".jpg,.jpeg,.png,.webp,.pdf";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function uploadViaBadge(via: string): { label: string; className: string } {
  if (via.includes("extraction")) {
    return {
      label: "AI extraction",
      className: "bg-blue-100 text-blue-700",
    };
  }
  return {
    label: "Manual attach",
    className: "bg-gray-100 text-gray-600",
  };
}

export default function AttachmentModal({
  targetId,
  context,
  label,
  onClose,
}: AttachmentModalProps) {
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [detaching, setDetaching] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function fetchFiles() {
    setLoading(true);
    setError(null);
    try {
      const joinTable =
        context === "receipt"
          ? "receipt_source_document"
          : "purchase_order_source_document";
      const joinColumn =
        context === "receipt" ? "receipt_id" : "purchase_order_id";

      const res = await fetch(
        `/api/document/list?table=${joinTable}&column=${joinColumn}&target_id=${targetId}`
      );
      if (!res.ok) throw new Error("Failed to load files");
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, context]);

  async function handleUpload() {
    const fileInput = inputRef.current;
    if (!fileInput?.files?.[0]) return;

    const file = fileInput.files[0];

    // Client-side validation
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Unsupported file type. Allowed: JPG, PNG, WebP, PDF.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("File too large (max 25 MB).");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/document/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_base64: base64,
          mime_type: file.type,
          file_name: file.name,
          context,
          target_id: targetId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      // Refresh file list
      fileInput.value = "";
      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDetach(docId: number) {
    if (!confirm("Remove this file from this " + (context === "receipt" ? "receipt" : "order") + "? The file itself will remain in storage.")) {
      return;
    }

    setDetaching(docId);
    setError(null);

    try {
      const res = await fetch(`/api/document/${docId}/detach`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, target_id: targetId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Detach failed");
      }

      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Detach failed");
    } finally {
      setDetaching(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-lg rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">
            Attached files for {label}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            &#10005;
          </button>
        </div>

        {/* Body */}
        <div className="max-h-80 overflow-y-auto px-5 py-4">
          {loading && (
            <p className="text-sm text-gray-500">Loading files...</p>
          )}

          {error && (
            <p className="mb-3 text-sm text-red-600">{error}</p>
          )}

          {!loading && files.length === 0 && (
            <p className="text-sm text-gray-500">No files attached yet.</p>
          )}

          {files.length > 0 && (
            <ul className="space-y-3">
              {files.map((f) => {
                const badge = uploadViaBadge(f.uploaded_via);
                return (
                  <li
                    key={f.id}
                    className="flex items-center justify-between rounded-md border border-gray-200 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {f.original_filename}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>{formatBytes(f.size_bytes)}</span>
                        <span>&middot;</span>
                        <span>{formatDate(f.uploaded_at)}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <a
                        href={`/api/document/${f.id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                        title="View file"
                      >
                        &#128065;
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDetach(f.id)}
                        disabled={detaching === f.id}
                        className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title={`Remove from this ${context}`}
                      >
                        {detaching === f.id ? (
                          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                        ) : (
                          "\u2716"
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Upload section */}
        <div className="border-t px-5 py-4">
          <p className="mb-2 text-sm font-medium text-gray-700">
            Attach new file
          </p>
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_STRING}
              disabled={uploading}
              className="text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            />
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
