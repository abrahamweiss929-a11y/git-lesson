"use client";

import { useState, useMemo } from "react";
import Icon from "@/components/ui/Icon";
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
    if (value === null || value === undefined) return "—";
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
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50/70 text-slate-500 text-xs border-b border-slate-200 backdrop-blur-sm">
            <tr>
              {table.columns.map((col) => {
                const isNumeric =
                  col.type === "number" || col.type === "currency";
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-4 py-2.5 font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-slate-700 transition-colors ${isNumeric ? "text-right" : "text-left"}`}
                  >
                    <span
                      className={`inline-flex items-center gap-1 ${isNumeric ? "justify-end w-full" : ""}`}
                    >
                      {col.label}
                      {active && (
                        <Icon
                          name={sortDir === "asc" ? "sortUp" : "sortDown"}
                          size={12}
                          className="text-slate-500"
                        />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedRows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                {table.columns.map((col, ci) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 whitespace-nowrap ${
                      col.type === "number" || col.type === "currency"
                        ? "text-right tabular-nums text-slate-700"
                        : ci === 0
                          ? "font-medium text-slate-900"
                          : "text-slate-700"
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
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/70 border-t border-slate-100 text-xs">
        <span className="text-slate-500 tabular-nums">
          {table.rows.length} row{table.rows.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-1">
          <button
            onClick={handleExcel}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-white text-emerald-700 font-medium transition-colors"
          >
            <Icon name="excel" size={12} />
            Excel
          </button>
          <button
            onClick={handlePdf}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-white text-rose-700 font-medium transition-colors"
          >
            <Icon name="pdf" size={12} />
            PDF
          </button>
        </div>
      </div>
    </div>
  );
}
