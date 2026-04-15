import * as XLSX from "xlsx";

export function downloadItemTemplate(): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    [
      "Item Code",
      "Item Name",
      "Manufacturer",
      "Manufacturer Verified",
      "Parts per Box",
      "Tests per Box",
      "Shelf Life (days)",
      "Test Type",
      "Machine",
      "Item Type",
      "Category",
      "Storage Requirements",
      "Average Order Qty",
      "Notes",
    ],
  ]);
  ws["!cols"] = [
    { wch: 20 }, // Item Code
    { wch: 30 }, // Item Name
    { wch: 25 }, // Manufacturer
    { wch: 22 }, // Manufacturer Verified
    { wch: 15 }, // Parts per Box
    { wch: 15 }, // Tests per Box
    { wch: 18 }, // Shelf Life (days)
    { wch: 15 }, // Test Type
    { wch: 20 }, // Machine
    { wch: 15 }, // Item Type
    { wch: 15 }, // Category
    { wch: 22 }, // Storage Requirements
    { wch: 18 }, // Average Order Qty
    { wch: 30 }, // Notes
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Items");
  XLSX.writeFile(wb, "items_template.xlsx");
}

export function downloadSupplierTemplate(): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    [
      "Item Code",
      "Supplier",
      "Their Item Code",
      "Price",
      "Currency",
      "Notes",
    ],
  ]);
  ws["!cols"] = [
    { wch: 20 }, // Item Code
    { wch: 25 }, // Supplier
    { wch: 20 }, // Their Item Code
    { wch: 12 }, // Price
    { wch: 10 }, // Currency
    { wch: 30 }, // Notes
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Supplier Info");
  XLSX.writeFile(wb, "suppliers_template.xlsx");
}
