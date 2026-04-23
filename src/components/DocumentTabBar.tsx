"use client";

import type { UploadedFileInfo } from "@/components/DocumentUpload";

interface DocumentTabBarProps {
  files: UploadedFileInfo[];
  activeId: string;
  onSelect: (id: string) => void;
}

export default function DocumentTabBar({
  files,
  activeId,
  onSelect,
}: DocumentTabBarProps) {
  if (files.length <= 1) return null;

  return (
    <div
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/70 px-2 pt-2"
      role="tablist"
    >
      {files.map((file) => {
        const isActive = file.id === activeId;
        return (
          <button
            key={file.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(file.id)}
            title={file.name}
            className={`shrink-0 rounded-t-lg px-4 py-2 text-xs font-medium transition-colors max-w-[200px] truncate ${
              isActive
                ? "bg-white text-slate-900 border border-slate-200 border-b-white -mb-px"
                : "bg-transparent text-slate-500 border border-transparent hover:bg-white/70 hover:text-slate-700"
            }`}
          >
            {file.name}
          </button>
        );
      })}
    </div>
  );
}
