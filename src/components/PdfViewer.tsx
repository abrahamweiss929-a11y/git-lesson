"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfViewerProps {
  url: string;
}

export default function PdfViewer({ url }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);

  return (
    <div className="flex h-full flex-col bg-gray-100">
      {/* Controls */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          disabled={scale <= 0.5}
          className="rounded border border-gray-300 px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
        >
          -
        </button>
        <span className="min-w-[3rem] text-center text-sm text-gray-600">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(3, s + 0.25))}
          disabled={scale >= 3}
          className="rounded border border-gray-300 px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setScale(1.0)}
          className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
        >
          Reset
        </button>
        {numPages > 0 && (
          <span className="ml-auto text-sm text-gray-500">
            {numPages} page{numPages !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Scrollable pages */}
      <div className="flex-1 overflow-y-auto p-4">
        <Document
          file={url}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={
            <div className="py-8 text-center text-gray-500">
              Loading PDF...
            </div>
          }
          error={
            <div className="py-8 text-center text-red-500">
              Failed to load PDF
            </div>
          }
        >
          {Array.from({ length: numPages }, (_, i) => (
            <Page
              key={i + 1}
              pageNumber={i + 1}
              scale={scale}
              className="mx-auto mb-4 shadow-md"
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          ))}
        </Document>
      </div>
    </div>
  );
}
