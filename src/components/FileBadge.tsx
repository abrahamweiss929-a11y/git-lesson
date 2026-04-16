"use client";

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
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors"
      title={`${count} attached file${count !== 1 ? "s" : ""}`}
    >
      <span>&#128206;</span>
      <span>{count}</span>
    </button>
  );
}
