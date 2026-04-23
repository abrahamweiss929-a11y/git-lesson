"use client";

import Icon from "@/components/ui/Icon";

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
    <div className="rounded-xl p-4 bg-gradient-to-br from-amber-50 to-amber-50/60 border border-amber-200/70 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
        <Icon name="sparkle" size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-amber-900 text-sm">
          &ldquo;{rawName}&rdquo; isn&rsquo;t in your Companies list yet.
        </p>
        <p className="text-xs text-amber-800/80 mt-1">
          Add it now, pick a different company, or ignore to continue.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAddNew(rawName)}
            className="text-xs font-semibold px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            Add &ldquo;{rawName}&rdquo;
          </button>
          <button
            type="button"
            onClick={onPickDifferent}
            className="text-xs font-medium px-3 py-1.5 rounded-md border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors"
          >
            Pick different
          </button>
          <button
            type="button"
            onClick={onIgnore}
            className="text-xs font-medium px-3 py-1.5 rounded-md text-amber-700 hover:text-amber-900 hover:bg-amber-100/60 transition-colors"
          >
            Ignore
          </button>
        </div>
      </div>
    </div>
  );
}
