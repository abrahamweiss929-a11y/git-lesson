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
}

type Status = "idle" | "reading" | "extracting" | "done" | "error";

export default function DocumentUpload({
  onExtracted,
  disabled,
}: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setStatus("idle");
    setErrorMessage(null);
  }

  async function handleExtract() {
    if (!file) return;

    // Client-side validation
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setStatus("error");
      setErrorMessage(
        `Unsupported file type. Allowed: JPG, PNG, WebP, PDF.`
      );
      return;
    }
    if (file.size > MAX_SIZE) {
      setStatus("error");
      setErrorMessage("File too large (max 10 MB).");
      return;
    }

    setStatus("reading");
    setErrorMessage(null);

    try {
      // Read file as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the data URI prefix (e.g. "data:image/jpeg;base64,")
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsDataURL(file);
      });

      setStatus("extracting");

      const res = await fetch("/api/extract-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_base64: base64,
          mime_type: file.type,
          file_name: file.name,
        }),
      });

      if (!res.ok) {
        const err: ExtractDocumentError = await res.json();
        throw new Error(err.error || "Extraction failed.");
      }

      const data: ExtractDocumentResponse = await res.json();

      if (data.line_items.length === 0) {
        setStatus("error");
        setErrorMessage(
          "No line items detected in this document. Please add items manually."
        );
        return;
      }

      setStatus("done");
      onExtracted(data);
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Extraction failed. Please fill the form manually."
      );
    }
  }

  function handleReset() {
    setFile(null);
    setStatus("idle");
    setErrorMessage(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const busy = status === "reading" || status === "extracting";

  return (
    <div className="rounded-md border border-dashed border-gray-300 bg-white p-4">
      <p className="text-sm font-medium text-gray-700 mb-3">
        Upload Document (Optional)
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_STRING}
          onChange={handleFileChange}
          disabled={disabled || busy}
          className="text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
        />
        <button
          type="button"
          onClick={handleExtract}
          disabled={!file || busy || disabled}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {status === "reading" ? "Reading file..." : "Extracting with AI..."}
            </span>
          ) : (
            "Extract with AI"
          )}
        </button>
        {status === "done" && (
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>

      {status === "done" && (
        <p className="mt-2 text-sm text-green-700">
          &#10003; Data extracted from {file?.name}
        </p>
      )}

      {status === "error" && errorMessage && (
        <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}
