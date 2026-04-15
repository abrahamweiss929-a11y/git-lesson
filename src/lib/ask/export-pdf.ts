import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface TableColumn {
  key: string;
  label: string;
}

interface TableResponse {
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
}

/**
 * Generate and download a PDF from a table result.
 */
export function downloadAnswerAsPdf(
  table: TableResponse,
  question: string,
  answer: string
) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(16);
  doc.text("Lab Inventory — Query Result", 14, 20);

  // Question
  doc.setFontSize(10);
  doc.setTextColor(100);
  const questionLines = doc.splitTextToSize(`Q: ${question}`, 180);
  doc.text(questionLines, 14, 30);

  // Answer
  let yPos = 30 + questionLines.length * 5 + 5;
  doc.setTextColor(0);
  doc.setFontSize(11);
  const answerLines = doc.splitTextToSize(answer, 180);
  doc.text(answerLines, 14, yPos);
  yPos += answerLines.length * 6 + 8;

  // Table
  if (table.columns.length > 0 && table.rows.length > 0) {
    const headers = table.columns.map((c) => c.label);
    const body = table.rows.map((row) =>
      table.columns.map((c) => {
        const val = row[c.key];
        if (val === null || val === undefined) return "";
        return String(val);
      })
    );

    autoTable(doc, {
      startY: yPos,
      head: [headers],
      body,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Generated ${new Date().toLocaleString()} — Page ${i} of ${pageCount}`,
      14,
      doc.internal.pageSize.height - 10
    );
  }

  // Download
  const now = new Date();
  const ts = now.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const filename = `inventory-answer-${ts}.pdf`;
  doc.save(filename);
}
