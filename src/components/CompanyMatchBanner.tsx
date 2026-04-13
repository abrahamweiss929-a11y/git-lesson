"use client";

interface CompanyMatchBannerProps {
  rawName: string;
  onAddNew: (name: string) => void;
  onPickDifferent: () => void;
  onIgnore: () => void;
}

export default function CompanyMatchBanner({
  rawName,
  onAddNew,
  onPickDifferent,
  onIgnore,
}: CompanyMatchBannerProps) {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
      <p className="text-amber-800">
        &#9888;&#65039; &ldquo;{rawName}&rdquo; was found on the document but
        isn&rsquo;t in your Companies list.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onAddNew(rawName)}
          className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
        >
          Add it now
        </button>
        <button
          type="button"
          onClick={onPickDifferent}
          className="rounded-md border border-amber-400 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
        >
          Pick a different company
        </button>
        <button
          type="button"
          onClick={onIgnore}
          className="rounded-md px-3 py-1 text-xs font-medium text-amber-600 hover:text-amber-800"
        >
          Ignore
        </button>
      </div>
    </div>
  );
}
