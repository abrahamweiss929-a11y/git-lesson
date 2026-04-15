"use client";

import { useState, useRef, useEffect } from "react";

interface DownloadDropdownProps {
  onExcel: () => void;
  onPdf: () => void;
}

export default function DownloadDropdown({
  onExcel,
  onPdf,
}: DownloadDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
      >
        <span>&#x2B07;</span>
        Download
        <span className="text-[10px]">&#x25BE;</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-20">
          <button
            onClick={() => {
              onExcel();
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Excel (.xlsx)
          </button>
          <button
            onClick={() => {
              onPdf();
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100"
          >
            PDF (.pdf)
          </button>
        </div>
      )}
    </div>
  );
}
