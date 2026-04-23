"use client";

import Button from "@/components/ui/Button";

interface DeleteConfirmModalProps {
  title: string;
  details: Array<{ label: string; value: string }>;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({
  title,
  details,
  deleting,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={deleting ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6"
      >
        <h3
          id="delete-modal-title"
          className="text-base font-bold text-slate-900 mb-4"
        >
          {title}
        </h3>
        <dl className="space-y-1.5 mb-5 rounded-lg bg-slate-50 border border-slate-200/70 p-3">
          {details.map((d) => (
            <div key={d.label} className="flex text-sm">
              <dt className="text-slate-500 w-28 shrink-0">{d.label}:</dt>
              <dd className="text-slate-800 font-medium">{d.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-slate-500 mb-5">This cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={deleting}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
