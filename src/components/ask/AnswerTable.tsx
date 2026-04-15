"use client";

import { useState, useMemo } from "react";
import DownloadDropdown from "./DownloadDropdown";
import { downloadAnswerAsExcel } from "@/lib/ask/export-excel";
import { downloadAnswerAsPdf } from "@/lib/ask/export-pdf";

interface TableColumn {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "boolean" | "currency";
}

interface TableData {
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
}

interface AnswerTableProps {
  table: TableData;
  question: string;
}

type SortDir = "asc" | "desc";

export default function AnswerTable({ table, question }: AnswerTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortKey) return table.rows;
    const col = table.columns.find((c) => c.key === sortKey);
    return [...table.rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      let cmp = 0;
      if (col?.type === "number" || col?.type === "currency") {
        cmp = Number(av) - Number(bv);
      } else if (col?.type === "date") {
        cmp = String(av).localeCompare(String(bv));
      } else {
        cmp = String(av)
          .toLowerCase()
          .localeCompare(String(bv).toLowerCase());
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [table.rows, table.columns, sortKey, sortDir]);

  function formatCell(value: unknown, type: string): string {
    if (value === null || value === undefined) return "\u2014";
    if (type === "currency") {
      const num = Number(value);
      return Number.isFinite(num)
        ? `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : String(value);
    }
    if (type === "boolean") {
      return value ? "Yes" : "No";
    }
    return String(value);
  }

  function handleExcel() {
    downloadAnswerAsExcel(table, question);
  }

  function handlePdf() {
    downloadAnswerAsPdf(table, question, question);
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header with download */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs text-gray-500">
          {table.rows.length} row{table.rows.length !== 1 ? "s" : ""}
        </span>
        <DownloadDropdown onExcel={handleExcel} onPdf={handlePdf} />
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              {table.columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1">
                      {sortDir === "asc" ? "\u25B2" : "\u25BC"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedRows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {table.columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 whitespace-nowrap ${
                      col.type === "number" || col.type === "currency"
                        ? "text-right tabular-nums"
                        : ""
                    }`}
                  >
                    {formatCell(row[col.key], col.type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
