"use client";

import { useEffect, useRef } from "react";
import Button from "@/components/ui/Button";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !importing) onCancel();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[80vh] overflow-hidden mx-4 flex flex-col">
        <div className="p-6 overflow-y-auto">
          <h2 className="text-base font-bold text-slate-900 mb-4">
            Some references not found
          </h2>

          {missingItemCodes.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-sm font-semibold text-amber-900 mb-2">
                {missingItemCodes.length} item code
                {missingItemCodes.length !== 1 ? "s" : ""} not found in Item
                Master
              </p>
              <ul className="list-disc list-inside text-sm text-amber-900/80 ml-1 space-y-0.5">
                {missingItemCodes.map((code) => (
                  <li key={code} className="font-mono text-xs">
                    {code}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {missingCompanies.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-sm font-semibold text-amber-900 mb-2">
                {missingCompanies.length} supplier
                {missingCompanies.length !== 1 ? "s" : ""} not found in
                Companies
              </p>
              <ul className="list-disc list-inside text-sm text-amber-900/80 ml-1 space-y-0.5">
                {missingCompanies.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2 mt-6">
            <Button
              variant="secondary"
              onClick={onSkipMissing}
              loading={importing}
              className="w-full"
            >
              Skip those rows — import the rest
            </Button>
            <Button
              onClick={onCreateAndImport}
              loading={importing}
              className="w-full"
            >
              Create empty items for missing codes and import everything
            </Button>
            <Button
              ref={cancelRef}
              variant="ghost"
              onClick={onCancel}
              disabled={importing}
              className="w-full"
            >
              Cancel upload
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
