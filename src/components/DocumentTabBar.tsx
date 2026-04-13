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
    <div className="flex shrink-0 gap-0 overflow-x-auto border-b border-gray-200 bg-white">
      {files.map((file) => (
        <button
          key={file.id}
          type="button"
          onClick={() => onSelect(file.id)}
          className={`shrink-0 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            file.id === activeId
              ? "border-blue-500 text-blue-700"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
          }`}
        >
          {file.name}
        </button>
      ))}
    </div>
  );
}
