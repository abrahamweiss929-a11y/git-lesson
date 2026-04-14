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
    <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-200 bg-gray-100 px-2 pt-2">
      {files.map((file) => {
        const isActive = file.id === activeId;
        return (
          <button
            key={file.id}
            type="button"
            onClick={() => onSelect(file.id)}
            title={file.name}
            className={`shrink-0 rounded-t-md px-4 py-2 text-xs font-medium transition-colors max-w-[200px] truncate ${
              isActive
                ? "bg-white text-gray-900 border border-gray-200 border-b-white -mb-px"
                : "bg-transparent text-gray-500 border border-transparent hover:bg-gray-200 hover:text-gray-700"
            }`}
          >
            {file.name}
          </button>
        );
      })}
    </div>
  );
}
