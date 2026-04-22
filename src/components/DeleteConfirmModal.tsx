"use client";

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
        className="absolute inset-0 bg-black/40"
        onClick={deleting ? undefined : onCancel}
      />
      <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-3">{title}</h3>
        <dl className="space-y-1 mb-4">
          {details.map((d) => (
            <div key={d.label} className="flex text-sm">
              <dt className="text-gray-500 w-28 shrink-0">{d.label}:</dt>
              <dd className="text-gray-700">{d.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-gray-500 mb-5">This cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {deleting && (
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
