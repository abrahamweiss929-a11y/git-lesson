"use client";

import { useRef, useState } from "react";
import type {
  ExtractDocumentResponse,
  ExtractDocumentError,
} from "@/lib/extract-document.types";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPT_STRING = ".jpg,.jpeg,.png,.webp,.pdf";

interface DocumentUploadProps {
  onExtracted: (result: ExtractDocumentResponse) => void;
  disabled?: boolean;
  context: "receipt" | "order";
}

type FileStatus = "pending" | "reading" | "extracting" | "done" | "error";

interface FileEntry {
  id: string;
  file: File;
  status: FileStatus;
  errorMessage?: string;
  result?: ExtractDocumentResponse;
}

function mergeResults(entries: FileEntry[]): ExtractDocumentResponse | null {
  const successful = entries.filter((e) => e.status === "done" && e.result);
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
        errorMessage: "File too large (max 10 MB).",
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

      if (data.line_items.length === 0) {
        return {
          ...entry,
          status: "error",
          errorMessage: "No line items detected in this document.",
        };
      }

      return { ...entry, status: "done", result: data };
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

    const merged = mergeResults(results);
    if (merged) {
      onExtracted(merged);
    }
  }

  function handleReset() {
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  const hasFiles = files.length > 0;
  const allDone =
    hasFiles &&
    files.every((f) => f.status === "done" || f.status === "error");
  const doneCount = files.filter((f) => f.status === "done").length;
  const totalItems = files
    .filter((f) => f.status === "done" && f.result)
    .reduce((sum, f) => sum + f.result!.line_items.length, 0);

  return (
    <div className="rounded-md border border-dashed border-gray-300 bg-white p-4">
      <p className="text-sm font-medium text-gray-700 mb-3">
        Upload Document{files.length !== 1 ? "s" : ""} (Optional)
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_STRING}
          multiple
          onChange={handleFileChange}
          disabled={disabled || busy}
          className="text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
        />
        <button
          type="button"
          onClick={handleExtract}
          disabled={!hasFiles || busy || disabled}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Extracting...
            </span>
          ) : (
            "Extract with AI"
          )}
        </button>
        {allDone && (
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>

      {/* Per-file status list (multi-file only) */}
      {files.length > 1 && (
        <ul className="mt-3 space-y-1">
          {files.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 text-sm">
              {entry.status === "pending" && (
                <span className="text-gray-400">&#9679;</span>
              )}
              {(entry.status === "reading" ||
                entry.status === "extracting") && (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              )}
              {entry.status === "done" && (
                <span className="text-green-600">&#10003;</span>
              )}
              {entry.status === "error" && (
                <span className="text-red-500">&#10007;</span>
              )}
              <span
                className={
                  entry.status === "error"
                    ? "text-red-600"
                    : entry.status === "done"
                      ? "text-green-700"
                      : "text-gray-600"
                }
              >
                {entry.file.name}
                {entry.status === "reading" && " — Reading..."}
                {entry.status === "extracting" && " — Extracting..."}
                {entry.status === "done" &&
                  entry.result &&
                  ` — ${entry.result.line_items.length} item${entry.result.line_items.length !== 1 ? "s" : ""}`}
                {entry.status === "error" &&
                  entry.errorMessage &&
                  ` — ${entry.errorMessage}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Single-file status messages */}
      {files.length === 1 && files[0].status === "done" && (
        <p className="mt-2 text-sm text-green-700">
          &#10003; Data extracted from {files[0].file.name}
        </p>
      )}

      {files.length === 1 &&
        files[0].status === "error" &&
        files[0].errorMessage && (
          <p className="mt-2 text-sm text-red-600">
            {files[0].errorMessage}
          </p>
        )}

      {/* Multi-file summary */}
      {files.length > 1 && allDone && doneCount > 0 && (
        <p className="mt-2 text-sm text-green-700">
          &#10003; Extracted {totalItems} item{totalItems !== 1 ? "s" : ""}{" "}
          from {doneCount} file{doneCount !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
