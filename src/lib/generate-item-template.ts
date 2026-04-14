import * as XLSX from "xlsx";

export function downloadItemTemplate(): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["Internal Name", "Parts per Box", "Tests per Box", "Default Shelf Life (days)"],
  ]);
  ws["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws, "Item Master");
  XLSX.writeFile(wb, "item_master_template.xlsx");
}
