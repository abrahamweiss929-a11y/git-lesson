"use client";

import { useRef, useState } from "react";
import type {
  ExtractDocumentResponse,
  ExtractDocumentError,
} from "@/lib/extract-document.types";

export interface UploadedFileInfo {
  id: string;
  name: string;
  mimeType: string;
  objectUrl: string;
}

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_SIZE = 25 * 1024 * 1024; // 25 MB (v5: raised from 10 MB)
const ACCEPT_STRING = ".jpg,.jpeg,.png,.webp,.pdf";

interface DocumentUploadProps {
  onExtracted: (result: ExtractDocumentResponse) => void;
  onFilesReady?: (files: UploadedFileInfo[]) => void;
  onSourceDocumentIds?: (ids: number[]) => void; // v5: collected per-file source_document_ids
  disabled?: boolean;
  context: "receipt" | "order";
}

type FileStatus = "pending" | "reading" | "extracting" | "done" | "error";

interface FileEntry {
  id: string;
  file: File;
  status: FileStatus;
  errorMessage?: string;
  warningMessage?: string; // v5: for extraction_failed (file saved but AI failed)
  result?: ExtractDocumentResponse;
  sourceDocumentId?: number; // v5: tracked even when extraction fails
}

function mergeResults(entries: FileEntry[]): ExtractDocumentResponse | null {
  const successful = entries.filter(
    (e) => e.status === "done" && e.result && !e.result.extraction_failed
  );
  if (successful.length === 0) return null;

  const allLineItems = successful.flatMap((e) => e.result!.line_items);
  const firstCompany =
    successful.find((e) => e.result!.company_match)?.result?.company_match ??
    null;
  const firstCompanyRaw =
    successful.find((e) => e.result!.company_name_raw)?.result
      ?.company_name_raw ?? null;
  const firstDate =
    successful.find((e) => e.result!.date)?.result?.date ?? null;
  const allNotes = successful
    .map((e) => e.result!.confidence_notes)
    .filter(Boolean)
    .join(" | ");
  const firstDocType = successful[0].result!.document_type;

  return {
    company_match: firstCompany,
    company_name_raw: firstCompanyRaw,
    date: firstDate,
    line_items: allLineItems,
    confidence_notes: allNotes,
    document_type: firstDocType,
  };
}

export default function DocumentUpload({
  onExtracted,
  onFilesReady,
  onSourceDocumentIds,
  disabled,
  context,
}: DocumentUploadProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    const entries: FileEntry[] = Array.from(selected).map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "pending" as FileStatus,
    }));
    setFiles(entries);
  }

  async function extractSingleFile(entry: FileEntry): Promise<FileEntry> {
    // Client-side validation
    if (!ACCEPTED_TYPES.includes(entry.file.type)) {
      return {
        ...entry,
        status: "error",
        errorMessage: "Unsupported file type. Allowed: JPG, PNG, WebP, PDF.",
      };
    }
    if (entry.file.size > MAX_SIZE) {
      return {
        ...entry,
        status: "error",
        errorMessage: "File too large (max 25 MB).",
      };
    }

    // Read file as base64
    setFiles((prev) =>
      prev.map((f) => (f.id === entry.id ? { ...f, status: "reading" } : f))
    );

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsDataURL(entry.file);
      });

      setFiles((prev) =>
        prev.map((f) =>
          f.id === entry.id ? { ...f, status: "extracting" } : f
        )
      );

      const res = await fetch("/api/extract-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_base64: base64,
          mime_type: entry.file.type,
          file_name: entry.file.name,
          context,
        }),
      });

      if (!res.ok) {
        const err: ExtractDocumentError = await res.json();
        throw new Error(err.error || "Extraction failed.");
      }

      const data: ExtractDocumentResponse = await res.json();

      // v5: Handle extraction_failed (file saved, but AI couldn't extract)
      if (data.extraction_failed) {
        return {
          ...entry,
          status: "done",
          result: data,
          sourceDocumentId: data.source_document_id,
          warningMessage:
            data.error_message ||
            "File saved, but auto-extraction failed. Please fill the form manually.",
        };
      }

      if (data.line_items.length === 0) {
        return {
          ...entry,
          status: "done",
          result: data,
          sourceDocumentId: data.source_document_id,
          warningMessage: "No line items detected. File saved — fill the form manually.",
        };
      }

      return {
        ...entry,
        status: "done",
        result: data,
        sourceDocumentId: data.source_document_id,
      };
    } catch (err) {
      return {
        ...entry,
        status: "error",
        errorMessage:
          err instanceof Error
            ? err.message
            : "Extraction failed. Please fill the form manually.",
      };
    }
  }

  async function handleExtract() {
    if (files.length === 0) return;

    setBusy(true);

    // Process files sequentially to avoid overwhelming the API
    const results: FileEntry[] = [];
    for (const entry of files) {
      const result = await extractSingleFile(entry);
      results.push(result);
      setFiles((prev) =>
        prev.map((f) => (f.id === result.id ? result : f))
      );
    }

    setBusy(false);

    // v5: Collect all source_document_ids (including extraction_failed ones)
    const sourceDocIds = results
      .filter((e) => e.sourceDocumentId != null)
      .map((e) => e.sourceDocumentId!);
    if (sourceDocIds.length > 0) {
      onSourceDocumentIds?.(sourceDocIds);
    }

    const merged = mergeResults(results);
    if (merged) {
      onExtracted(merged);
    }

    // Expose file data for document viewer
    const fileInfos: UploadedFileInfo[] = results
      .filter((e) => e.status === "done")
      .map((e) => ({
        id: e.id,
        name: e.file.name,
        mimeType: e.file.type,
        objectUrl: URL.createObjectURL(e.file),
      }));
    onFilesReady?.(fileInfos);
  }

  function handleReset() {
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
    onFilesReady?.([]);
    onSourceDocumentIds?.([]);
  }

  const hasFiles = files.length > 0;
  const allDone =
    hasFiles &&
    files.every((f) => f.status === "done" || f.status === "error");
  const doneCount = files.filter((f) => f.status === "done").length;
  const warningCount = files.filter((f) => f.warningMessage).length;
  const totalItems = files
    .filter((f) => f.status === "done" && f.result && !f.result.extraction_failed)
    .reduce((sum, f) => sum + f.result!.line_items.length, 0);

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-gradient-to-br from-teal-50/50 via-white to-amber-50/30 p-5">
      <p className="text-sm font-semibold text-slate-800 mb-3">
        Upload Document{files.length !== 1 ? "s" : ""}{" "}
        <span className="font-normal text-slate-500">(optional)</span>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_STRING}
          multiple
          onChange={handleFileChange}
          disabled={disabled || busy}
          className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-50 file:transition-colors file:cursor-pointer"
        />
        <button
          type="button"
          onClick={handleExtract}
          disabled={!hasFiles || busy || disabled}
          className="inline-flex items-center justify-center gap-2 font-semibold rounded-lg px-4 py-2.5 text-sm h-10 bg-gradient-to-br from-teal-600 to-teal-700 text-white shadow-[0_4px_14px_-2px_rgba(13,148,136,0.4)] hover:shadow-[0_6px_20px_-4px_rgba(13,148,136,0.5)] hover:-translate-y-px transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Extracting…
            </span>
          ) : (
            <>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/><path d="M19 17l.6 1.8L21 19l-1.4.4L19 21l-.6-1.6L17 19l1.4-.2z"/></svg>
              Extract with AI
            </>
          )}
        </button>
        {allDone && (
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-slate-500 hover:text-slate-700 font-medium"
          >
            Clear
          </button>
        )}
      </div>

      {/* Per-file status list (multi-file only) */}
      {files.length > 1 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 text-sm">
              {entry.status === "pending" && (
                <span className="w-2 h-2 rounded-full bg-slate-300" aria-hidden="true" />
              )}
              {(entry.status === "reading" ||
                entry.status === "extracting") && (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
              )}
              {entry.status === "done" && !entry.warningMessage && (
                <span className="text-emerald-600" aria-hidden="true">✓</span>
              )}
              {entry.status === "done" && entry.warningMessage && (
                <span className="text-amber-500" aria-hidden="true">⚠</span>
              )}
              {entry.status === "error" && (
                <span className="text-rose-500" aria-hidden="true">✕</span>
              )}
              <span
                className={
                  entry.status === "error"
                    ? "text-rose-700"
                    : entry.warningMessage
                      ? "text-amber-700"
                      : entry.status === "done"
                        ? "text-emerald-700"
                        : "text-slate-600"
                }
              >
                <span className="font-medium">{entry.file.name}</span>
                {entry.status === "reading" && " — Reading…"}
                {entry.status === "extracting" && " — Extracting…"}
                {entry.status === "done" &&
                  !entry.warningMessage &&
                  entry.result &&
                  ` — ${entry.result.line_items.length} item${entry.result.line_items.length !== 1 ? "s" : ""}`}
                {entry.warningMessage && ` — ${entry.warningMessage}`}
                {entry.status === "error" &&
                  entry.errorMessage &&
                  ` — ${entry.errorMessage}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Single-file status messages */}
      {files.length === 1 && files[0].status === "done" && !files[0].warningMessage && (
        <p className="mt-3 text-sm text-emerald-700 font-medium">
          ✓ Data extracted from {files[0].file.name}
        </p>
      )}

      {files.length === 1 && files[0].warningMessage && (
        <p className="mt-3 text-sm text-amber-700 font-medium">
          ⚠ {files[0].warningMessage}
        </p>
      )}

      {files.length === 1 &&
        files[0].status === "error" &&
        files[0].errorMessage && (
          <p className="mt-3 text-sm text-rose-700 font-medium">
            {files[0].errorMessage}
          </p>
        )}

      {/* Multi-file summary */}
      {files.length > 1 && allDone && doneCount > 0 && (
        <div className="mt-3 space-y-1">
          {totalItems > 0 && (
            <p className="text-sm text-emerald-700 font-medium">
              ✓ Extracted {totalItems} item{totalItems !== 1 ? "s" : ""} from{" "}
              {doneCount - warningCount} file
              {doneCount - warningCount !== 1 ? "s" : ""}
            </p>
          )}
          {warningCount > 0 && (
            <p className="text-sm text-amber-700 font-medium">
              ⚠ {warningCount} file{warningCount !== 1 ? "s" : ""} saved but
              extraction failed — fill data manually
            </p>
          )}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-slate-200/70 text-xs text-slate-500">
        JPG, PNG, WebP, PDF · max 25 MB
      </div>
    </div>
  );
}
