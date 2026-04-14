"use client";

import { useEffect, useRef } from "react";
import type { ImportDiff } from "@/lib/parse-item-spreadsheet";

interface BulkImportModalProps {
  diff: ImportDiff;
  importing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function BulkImportModal({
  diff,
  importing,
  onConfirm,
  onCancel,
}: BulkImportModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus cancel button on mount and handle Escape
  useEffect(() => {
    cancelRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !importing) {
        onCancel();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, importing]);

  const { toInsert, toUpdate } = diff;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !importing) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Ready to import?
        </h2>

        <ul className="space-y-2 mb-6">
          {toInsert.length > 0 && (
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-0.5 text-green-600 font-bold">+</span>
              <span>
                <strong>{toInsert.length}</strong> new item
                {toInsert.length !== 1 ? "s" : ""} will be added
              </span>
            </li>
          )}
          {toUpdate.length > 0 && (
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-0.5 text-blue-600 font-bold">~</span>
              <span>
                <strong>{toUpdate.length}</strong> existing item
                {toUpdate.length !== 1 ? "s" : ""} will be updated
                <span className="text-gray-500">
                  {" "}
                  (their current data will be replaced)
                </span>
              </span>
            </li>
          )}
        </ul>

        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={importing}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={importing}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {importing ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Importing...
              </span>
            ) : (
              "Confirm Import"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
