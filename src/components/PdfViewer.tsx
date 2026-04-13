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
    <div className="flex h-full flex-col bg-white">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-gray-200 bg-white px-3 py-1.5">
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.25, s - 0.25))}
          disabled={scale <= 0.25}
          className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:hover:bg-white"
          title="Zoom out"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
          </svg>
        </button>
        <span className="min-w-[3rem] text-center text-xs font-medium text-gray-600">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(4, s + 0.25))}
          disabled={scale >= 4}
          className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:hover:bg-white"
          title="Zoom in"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
          </svg>
        </button>
        <div className="mx-1 h-4 w-px bg-gray-300" />
        <button
          type="button"
          onClick={() => setScale(1.0)}
          className="flex h-7 items-center justify-center rounded border border-gray-300 px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 active:bg-gray-200"
          title="Reset zoom"
        >
          Fit
        </button>
        {numPages > 0 && (
          <span className="ml-auto text-xs text-gray-500">
            {numPages} page{numPages !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Scrollable pages */}
      <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
        <Document
          file={url}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                Loading PDF...
              </div>
            </div>
          }
          error={
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-red-500">Failed to load PDF</p>
            </div>
          }
        >
          <div className="flex flex-col items-center gap-4">
            {Array.from({ length: numPages }, (_, i) => (
              <div key={i + 1} className="bg-white shadow-md">
                <Page
                  pageNumber={i + 1}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </div>
            ))}
          </div>
        </Document>
      </div>
    </div>
  );
}
