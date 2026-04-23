"use client";

import { useEffect, useRef } from "react";
import type { ImportDiff } from "@/lib/parse-item-spreadsheet";
import Button from "@/components/ui/Button";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !importing) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl mx-4">
        <h2 className="text-base font-bold text-slate-900 mb-4">
          Ready to import?
        </h2>

        <ul className="space-y-2.5 mb-6">
          {toInsert.length > 0 && (
            <li className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold shrink-0">
                +
              </span>
              <span className="text-slate-700">
                <strong className="text-slate-900 tabular-nums">
                  {toInsert.length}
                </strong>{" "}
                new item{toInsert.length !== 1 ? "s" : ""} will be added
              </span>
            </li>
          )}
          {toUpdate.length > 0 && (
            <li className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-sky-700 font-bold shrink-0">
                ~
              </span>
              <span className="text-slate-700">
                <strong className="text-slate-900 tabular-nums">
                  {toUpdate.length}
                </strong>{" "}
                existing item{toUpdate.length !== 1 ? "s" : ""} will be updated
                <span className="text-slate-500">
                  {" "}
                  (their current data will be replaced)
                </span>
              </span>
            </li>
          )}
        </ul>

        <div className="flex justify-end gap-3">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onCancel}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} loading={importing}>
            Confirm Import
          </Button>
        </div>
      </div>
    </div>
  );
}
