import * as XLSX from "xlsx";

interface TableColumn {
  key: string;
  label: string;
}

interface TableResponse {
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
}

/**
 * Generate and download an Excel file from a table result.
 */
export function downloadAnswerAsExcel(
  table: TableResponse,
  question: string
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Results
  const headers = table.columns.map((c) => c.label);
  const dataRows = table.rows.map((row) =>
    table.columns.map((c) => {
      const val = row[c.key];
      return val === null || val === undefined ? "" : val;
    })
  );
  const wsData = [headers, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-size columns
  const colWidths = headers.map((h, i) => {
    const maxData = dataRows.reduce(
      (max, row) => Math.max(max, String(row[i] ?? "").length),
      0
    );
    return { wch: Math.max(h.length, maxData) + 2 };
  });
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Results");

  // Sheet 2: About
  const aboutWs = XLSX.utils.aoa_to_sheet([
    ["Question", question],
    ["Generated", new Date().toLocaleString()],
    ["Rows", table.rows.length],
  ]);
  XLSX.utils.book_append_sheet(wb, aboutWs, "About");

  // Generate filename and download
  const now = new Date();
  const ts = now.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const filename = `inventory-answer-${ts}.xlsx`;

  XLSX.writeFile(wb, filename);
}
