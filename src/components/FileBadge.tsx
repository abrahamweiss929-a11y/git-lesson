"use client";

import Icon from "@/components/ui/Icon";

/**
 * Displays a paperclip icon with a file count for list views.
 * Click triggers the onOpen callback (to open AttachmentModal).
 */
export default function FileBadge({
  count,
  onClick,
}: {
  count: number;
  onClick?: () => void;
}) {
  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50/40 transition-colors"
      title={`${count} attached file${count !== 1 ? "s" : ""}`}
    >
      <Icon name="paperclip" size={12} />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
