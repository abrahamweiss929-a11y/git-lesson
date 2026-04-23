"use client";

import Icon from "@/components/ui/Icon";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-slate-600">
      <span className="tabular-nums">
        Showing <span className="font-semibold text-slate-900">{from}</span>–
        <span className="font-semibold text-slate-900">{to}</span> of{" "}
        <span className="font-semibold text-slate-900">{totalCount}</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1"
        >
          <Icon name="chevronLeft" size={14} />
          Prev
        </button>
        <span className="text-xs text-slate-500 tabular-nums px-1">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1"
        >
          Next
          <Icon name="chevronRight" size={14} />
        </button>
      </div>
    </div>
  );
}
