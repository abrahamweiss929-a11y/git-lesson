"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { UploadedFileInfo } from "@/components/DocumentUpload";
import DocumentTabBar from "@/components/DocumentTabBar";
import ImageViewer from "@/components/ImageViewer";

const PdfViewer = dynamic(() => import("@/components/PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-white text-sm text-slate-500">
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-teal-500 border-t-transparent mr-3" />
      Loading viewer…
    </div>
  ),
});

interface DocumentPaneProps {
  files: UploadedFileInfo[];
}

export default function DocumentPane({ files }: DocumentPaneProps) {
  const [activeId, setActiveId] = useState(files[0]?.id ?? "");

  const activeFile = files.find((f) => f.id === activeId) ?? files[0];

  if (!activeFile) return null;

  const isPdf = activeFile.mimeType === "application/pdf";

  return (
    <div className="flex h-full flex-col bg-white">
      <DocumentTabBar
        files={files}
        activeId={activeFile.id}
        onSelect={setActiveId}
      />
      <div className="flex-1 overflow-hidden">
        {isPdf ? (
          <PdfViewer url={activeFile.objectUrl} />
        ) : (
          <ImageViewer url={activeFile.objectUrl} />
        )}
      </div>
    </div>
  );
}
