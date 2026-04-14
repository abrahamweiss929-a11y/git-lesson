"use client";

import { useEffect, useRef } from "react";

interface MissingReferencesModalProps {
  missingItemCodes: string[];
  missingCompanies: string[];
  importing: boolean;
  onSkipMissing: () => void;
  onCreateAndImport: () => void;
  onCancel: () => void;
}

export default function MissingReferencesModal({
  missingItemCodes,
  missingCompanies,
  importing,
  onSkipMissing,
  onCreateAndImport,
  onCancel,
}: MissingReferencesModalProps) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !importing) onCancel();
      }}
    >
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl max-h-[80vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Some references not found
        </h2>

        {missingItemCodes.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-amber-700 mb-2">
              {missingItemCodes.length} item code
              {missingItemCodes.length !== 1 ? "s" : ""} not found in Item
              Master:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 ml-2 space-y-0.5">
              {missingItemCodes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </div>
        )}

        {missingCompanies.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-amber-700 mb-2">
              {missingCompanies.length} supplier
              {missingCompanies.length !== 1 ? "s" : ""} not found in Companies:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 ml-2 space-y-0.5">
              {missingCompanies.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2 mt-6">
          <button
            type="button"
            onClick={onSkipMissing}
            disabled={importing}
            className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {importing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                Importing...
              </span>
            ) : (
              "Skip those rows — import the rest"
            )}
          </button>
          <button
            type="button"
            onClick={onCreateAndImport}
            disabled={importing}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {importing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating &amp; importing...
              </span>
            ) : (
              "Create empty items for missing codes and import everything"
            )}
          </button>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={importing}
            className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel upload
          </button>
        </div>
      </div>
    </div>
  );
}
