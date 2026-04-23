"use client";

import { useEffect, useState, useRef } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Badge from "@/components/ui/Badge";

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
        `/api/document/list?table=${joinTable}&column=${joinColumn}&target_id=${targetId}`,
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

      fileInput.value = "";
      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDetach(docId: number) {
    if (
      !confirm(
        "Remove this file from this " +
          (context === "receipt" ? "receipt" : "order") +
          "? The file itself will remain in storage.",
      )
    ) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">
            Attached files ·{" "}
            <span className="text-slate-500 font-medium">{label}</span>
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-80 overflow-y-auto px-5 py-4">
          {loading && (
            <p className="text-sm text-slate-500">Loading files…</p>
          )}

          {error && (
            <p className="mb-3 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          {!loading && files.length === 0 && (
            <p className="text-sm text-slate-500">No files attached yet.</p>
          )}

          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((f) => {
                const isAi = f.uploaded_via.includes("extraction");
                return (
                  <li
                    key={f.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-300 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {f.original_filename}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="tabular-nums">
                          {formatBytes(f.size_bytes)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDate(f.uploaded_at)}</span>
                        <Badge color={isAi ? "amber" : "slate"}>
                          {isAi ? "AI extraction" : "Manual attach"}
                        </Badge>
                      </div>
                    </div>
                    <div className="ml-3 flex items-center gap-1">
                      <a
                        href={`/api/document/${f.id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                        title="View file"
                      >
                        <Icon name="arrow" size={14} />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDetach(f.id)}
                        disabled={detaching === f.id}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 transition-colors"
                        title={`Remove from this ${context}`}
                      >
                        {detaching === f.id ? (
                          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-rose-400 border-t-transparent" />
                        ) : (
                          <Icon name="trash" size={14} />
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
        <div className="border-t border-slate-200 bg-slate-50/40 px-5 py-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">
            Attach new file
          </p>
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_STRING}
              disabled={uploading}
              className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-50 file:transition-colors file:cursor-pointer flex-1 min-w-0"
            />
            <Button onClick={handleUpload} loading={uploading} size="sm">
              Upload
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
