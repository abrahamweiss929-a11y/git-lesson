"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Item } from "@/lib/types";
import { useRef } from "react";
import StatusMessage from "@/components/StatusMessage";
import Pagination from "@/components/Pagination";
import CollapsibleSection from "@/components/CollapsibleSection";
import BulkImportModal from "@/components/BulkImportModal";
import MissingReferencesModal from "@/components/MissingReferencesModal";
import { downloadItemTemplate, downloadSupplierTemplate } from "@/lib/generate-item-template";
import {
  parseItemSpreadsheet,
  diffWithExisting,
  type ImportDiff,
} from "@/lib/parse-item-spreadsheet";
import {
  parseSupplierSpreadsheet,
  analyzeSupplierImport,
  type ParsedSupplierRow,
  type SupplierImportAnalysis,
} from "@/lib/parse-supplier-spreadsheet";

const PAGE_SIZE = 25;

type SortColumn = "item_code" | "item_name" | "manufacturer" | "category";
type SortDir = "asc" | "desc";

function sanitizeSearch(raw: string): string {
  return raw
    .replace(/[,()]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

export default function ItemsPage() {
  const router = useRouter();

  // Data
  const [items, setItems] = useState<Item[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Pagination & sort
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>("item_code");
  const [sortDirection, setSortDirection] = useState<SortDir>("asc");

  // Single-item add form
  const [addForm, setAddForm] = useState({
    item_code: "",
    item_name: "",
    manufacturer: "",
    manufacturer_verified: false,
    parts_per_box: "",
    tests_per_box: "",
    shelf_life_days: "",
    test_type: "",
    machine: "",
    item_type: "",
    category: "",
    storage_requirements: "",
    average_order_qty: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  // Items bulk upload
  const itemFileInputRef = useRef<HTMLInputElement>(null);
  const [itemBulkDiff, setItemBulkDiff] = useState<ImportDiff | null>(null);
  const [itemImporting, setItemImporting] = useState(false);

  // Supplier bulk upload
  const supplierFileInputRef = useRef<HTMLInputElement>(null);
  const [supplierRows, setSupplierRows] = useState<ParsedSupplierRow[] | null>(null);
  const [supplierAnalysis, setSupplierAnalysis] = useState<SupplierImportAnalysis | null>(null);
  const [supplierImporting, setSupplierImporting] = useState(false);
  const [showMissingRefs, setShowMissingRefs] = useState(false);

  // Status
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchItems = useCallback(async () => {
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("item")
      .select("*", { count: "exact" })
      .order(sortColumn, { ascending: sortDirection === "asc" })
      .range(from, to);

    if (debouncedQuery.trim()) {
      const escaped = sanitizeSearch(debouncedQuery.trim());
      query = query.or(
        `item_code.ilike.%${escaped}%,item_name.ilike.%${escaped}%`
      );
    }

    const { data, count, error } = await query;

    if (error) {
      setStatus({ type: "error", message: error.message });
      return;
    }

    setItems(data ?? []);
    setTotalCount(count ?? 0);
  }, [currentPage, sortColumn, sortDirection, debouncedQuery]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function handleSort(col: SortColumn) {
    if (col === sortColumn) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  }

  function sortArrow(col: SortColumn) {
    if (col !== sortColumn) return "";
    return sortDirection === "asc" ? " ↑" : " ↓";
  }

  function handlePageChange(page: number) {
    setCurrentPage(page);
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.item_code.trim()) return;
    setSaving(true);
    setStatus(null);

    const { error } = await supabase.from("item").insert({
      item_code: addForm.item_code.trim(),
      item_name: addForm.item_name.trim() || null,
      manufacturer: addForm.manufacturer.trim() || null,
      manufacturer_verified: addForm.manufacturer_verified,
      parts_per_box: addForm.parts_per_box ? parseInt(addForm.parts_per_box) : null,
      tests_per_box: addForm.tests_per_box ? parseInt(addForm.tests_per_box) : null,
      shelf_life_days: addForm.shelf_life_days ? parseInt(addForm.shelf_life_days) : null,
      test_type: addForm.test_type.trim() || null,
      machine: addForm.machine.trim() || null,
      item_type: addForm.item_type.trim() || null,
      category: addForm.category.trim() || null,
      storage_requirements: addForm.storage_requirements.trim() || null,
      average_order_qty: addForm.average_order_qty ? parseInt(addForm.average_order_qty) : null,
      notes: addForm.notes.trim() || null,
    });

    if (error) {
      setStatus({
        type: "error",
        message: error.message.includes("item_code_unique")
          ? `Item code "${addForm.item_code.trim()}" already exists.`
          : error.message,
      });
    } else {
      setStatus({ type: "success", message: "Item added." });
      setAddForm({
        item_code: "", item_name: "", manufacturer: "",
        manufacturer_verified: false, parts_per_box: "", tests_per_box: "",
        shelf_life_days: "", test_type: "", machine: "", item_type: "",
        category: "", storage_requirements: "", average_order_qty: "", notes: "",
      });
      fetchItems();
    }
    setSaving(false);
  }

  /* ---- Items bulk upload handlers ---- */
  async function handleItemFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (itemFileInputRef.current) itemFileInputRef.current.value = "";
    setStatus(null);

    const result = await parseItemSpreadsheet(file);
    if (!result.success) {
      setStatus({ type: "error", message: result.error });
      return;
    }

    // Fetch all items for diffing
    const { data: allItems } = await supabase
      .from("item")
      .select("id, item_code");
    const diff = diffWithExisting(result.rows, allItems ?? []);
    if (diff.toInsert.length === 0 && diff.toUpdate.length === 0) {
      setStatus({ type: "error", message: "No new or updated items found in file." });
      return;
    }
    setItemBulkDiff(diff);
  }

  async function handleConfirmItemImport() {
    if (!itemBulkDiff) return;
    setItemImporting(true);
    setStatus(null);

    try {
      if (itemBulkDiff.toInsert.length > 0) {
        const { error } = await supabase.from("item").insert(
          itemBulkDiff.toInsert.map((row) => ({
            item_code: row.item_code,
            item_name: row.item_name,
            manufacturer: row.manufacturer,
            manufacturer_verified: row.manufacturer_verified,
            parts_per_box: row.parts_per_box,
            tests_per_box: row.tests_per_box,
            shelf_life_days: row.shelf_life_days,
            test_type: row.test_type,
            machine: row.machine,
            item_type: row.item_type,
            category: row.category,
            storage_requirements: row.storage_requirements,
            average_order_qty: row.average_order_qty,
            notes: row.notes,
          }))
        );
        if (error) {
          setStatus({ type: "error", message: `Insert failed: ${error.message}` });
          setItemImporting(false);
          setItemBulkDiff(null);
          fetchItems();
          return;
        }
      }

      if (itemBulkDiff.toUpdate.length > 0) {
        const updateResults = await Promise.all(
          itemBulkDiff.toUpdate.map((row) =>
            supabase
              .from("item")
              .update({
                item_code: row.item_code,
                item_name: row.item_name,
                manufacturer: row.manufacturer,
                manufacturer_verified: row.manufacturer_verified,
                parts_per_box: row.parts_per_box,
                tests_per_box: row.tests_per_box,
                shelf_life_days: row.shelf_life_days,
                test_type: row.test_type,
                machine: row.machine,
                item_type: row.item_type,
                category: row.category,
                storage_requirements: row.storage_requirements,
                average_order_qty: row.average_order_qty,
                notes: row.notes,
              })
              .eq("id", row.existingId)
          )
        );

        const firstError = updateResults.find((r) => r.error);
        if (firstError?.error) {
          setStatus({ type: "error", message: `Some updates failed: ${firstError.error.message}` });
          setItemImporting(false);
          setItemBulkDiff(null);
          fetchItems();
          return;
        }
      }

      const added = itemBulkDiff.toInsert.length;
      const updated = itemBulkDiff.toUpdate.length;
      const parts = [];
      if (added > 0) parts.push(`${added} item${added !== 1 ? "s" : ""} added`);
      if (updated > 0) parts.push(`${updated} item${updated !== 1 ? "s" : ""} updated`);
      setStatus({ type: "success", message: `Import complete — ${parts.join(", ")}.` });
      setItemBulkDiff(null);
      fetchItems();
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Import failed." });
      setItemBulkDiff(null);
      fetchItems();
    } finally {
      setItemImporting(false);
    }
  }

  /* ---- Supplier bulk upload handlers ---- */
  async function handleSupplierFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (supplierFileInputRef.current) supplierFileInputRef.current.value = "";
    setStatus(null);

    const result = await parseSupplierSpreadsheet(file);
    if (!result.success) {
      setStatus({ type: "error", message: result.error });
      return;
    }

    // Fetch items and companies for cross-reference
    const [{ data: allItems }, { data: allCompanies }] = await Promise.all([
      supabase.from("item").select("id, item_code"),
      supabase.from("company").select("id, name"),
    ]);

    const analysis = analyzeSupplierImport(
      result.rows,
      allItems ?? [],
      allCompanies ?? []
    );

    setSupplierRows(result.rows);
    setSupplierAnalysis(analysis);

    if (analysis.missingItemCodes.length > 0 || analysis.missingCompanies.length > 0) {
      setShowMissingRefs(true);
    } else {
      // All references found — proceed directly
      await executeSupplierImport(analysis.readyToImport);
    }
  }

  async function executeSupplierImport(
    rows: SupplierImportAnalysis["readyToImport"]
  ) {
    if (rows.length === 0) {
      setStatus({ type: "error", message: "No valid supplier rows to import." });
      return;
    }

    setSupplierImporting(true);
    setStatus(null);

    try {
      const { error } = await supabase.from("item_supplier").upsert(
        rows.map((row) => ({
          item_id: row.item_id,
          company_id: row.company_id,
          their_item_code: row.their_item_code,
          price: row.price,
          currency: row.currency || "USD",
          notes: row.notes,
          last_price_update: row.price != null ? new Date().toISOString() : null,
        })),
        { onConflict: "item_id,company_id" }
      );

      if (error) {
        setStatus({ type: "error", message: `Supplier import failed: ${error.message}` });
      } else {
        setStatus({
          type: "success",
          message: `Supplier import complete — ${rows.length} record${rows.length !== 1 ? "s" : ""} imported.`,
        });
      }
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Supplier import failed.",
      });
    } finally {
      setSupplierImporting(false);
      setShowMissingRefs(false);
      setSupplierRows(null);
      setSupplierAnalysis(null);
    }
  }

  async function handleSkipMissing() {
    if (!supplierAnalysis) return;
    await executeSupplierImport(supplierAnalysis.readyToImport);
  }

  async function handleCreateAndImport() {
    if (!supplierRows || !supplierAnalysis) return;
    setSupplierImporting(true);
    setStatus(null);

    try {
      // Create missing companies
      if (supplierAnalysis.missingCompanies.length > 0) {
        const { error } = await supabase
          .from("company")
          .insert(supplierAnalysis.missingCompanies.map((name) => ({ name })));
        if (error) {
          setStatus({ type: "error", message: `Failed to create companies: ${error.message}` });
          setSupplierImporting(false);
          return;
        }
      }

      // Create missing items (just item_code, everything else null)
      if (supplierAnalysis.missingItemCodes.length > 0) {
        const { error } = await supabase
          .from("item")
          .insert(supplierAnalysis.missingItemCodes.map((code) => ({ item_code: code })));
        if (error) {
          setStatus({ type: "error", message: `Failed to create items: ${error.message}` });
          setSupplierImporting(false);
          return;
        }
      }

      // Re-fetch items and companies, re-analyze
      const [{ data: allItems }, { data: allCompanies }] = await Promise.all([
        supabase.from("item").select("id, item_code"),
        supabase.from("company").select("id, name"),
      ]);

      const newAnalysis = analyzeSupplierImport(
        supplierRows,
        allItems ?? [],
        allCompanies ?? []
      );

      await executeSupplierImport(newAnalysis.readyToImport);
      fetchItems(); // refresh the items table since we may have created new items
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Import failed.",
      });
      setSupplierImporting(false);
      setShowMissingRefs(false);
      setSupplierRows(null);
      setSupplierAnalysis(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Items</h1>
        <span className="text-sm text-gray-500">
          {totalCount} item{totalCount !== 1 ? "s" : ""} in system
        </span>
      </div>

      {status && (
        <div className="mb-4">
          <StatusMessage
            type={status.type}
            message={status.message}
            onDismiss={() => setStatus(null)}
          />
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by item code or name..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      {/* Collapsible sections */}
      <div className="space-y-2 mb-6">
        <CollapsibleSection title="Add single item manually">
          <form onSubmit={handleAddItem} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Code *</label>
                <input type="text" value={addForm.item_code} onChange={(e) => setAddForm({ ...addForm, item_code: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                <input type="text" value={addForm.item_name} onChange={(e) => setAddForm({ ...addForm, item_name: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                <input type="text" value={addForm.manufacturer} onChange={(e) => setAddForm({ ...addForm, manufacturer: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parts per Box</label>
                <input type="number" inputMode="numeric" value={addForm.parts_per_box} onChange={(e) => setAddForm({ ...addForm, parts_per_box: e.target.value })} min="1" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tests per Box</label>
                <input type="number" inputMode="numeric" value={addForm.tests_per_box} onChange={(e) => setAddForm({ ...addForm, tests_per_box: e.target.value })} min="1" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shelf Life (days)</label>
                <input type="number" inputMode="numeric" value={addForm.shelf_life_days} onChange={(e) => setAddForm({ ...addForm, shelf_life_days: e.target.value })} min="1" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Type</label>
                <input type="text" value={addForm.test_type} onChange={(e) => setAddForm({ ...addForm, test_type: e.target.value })} placeholder="e.g. HbA1c" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Machine</label>
                <input type="text" value={addForm.machine} onChange={(e) => setAddForm({ ...addForm, machine: e.target.value })} placeholder="e.g. DxC 700 AU" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
                <input type="text" value={addForm.item_type} onChange={(e) => setAddForm({ ...addForm, item_type: e.target.value })} placeholder="Reagent / calibrator / etc." className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input type="text" value={addForm.category} onChange={(e) => setAddForm({ ...addForm, category: e.target.value })} placeholder="Chemistry / hematology / etc." className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Storage Requirements</label>
                <input type="text" value={addForm.storage_requirements} onChange={(e) => setAddForm({ ...addForm, storage_requirements: e.target.value })} placeholder="Refrigerated / frozen / room temp" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Average Order Qty</label>
                <input type="number" inputMode="numeric" value={addForm.average_order_qty} onChange={(e) => setAddForm({ ...addForm, average_order_qty: e.target.value })} min="1" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} rows={2} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="add-mfr-verified" checked={addForm.manufacturer_verified} onChange={(e) => setAddForm({ ...addForm, manufacturer_verified: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor="add-mfr-verified" className="text-sm text-gray-700">Manufacturer Verified</label>
              </div>
            </div>
            <button type="submit" disabled={saving || !addForm.item_code.trim()} className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save Item"}
            </button>
          </form>
        </CollapsibleSection>

        <CollapsibleSection title="Bulk upload items (Excel)">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={downloadItemTemplate}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Download Template
            </button>
            <button
              type="button"
              onClick={() => itemFileInputRef.current?.click()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Upload Items
            </button>
            <input
              ref={itemFileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleItemFileSelected}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Bulk upload supplier info (Excel)">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={downloadSupplierTemplate}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Download Supplier Template
            </button>
            <button
              type="button"
              onClick={() => supplierFileInputRef.current?.click()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Upload Suppliers
            </button>
            <input
              ref={supplierFileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleSupplierFileSelected}
            />
          </div>
        </CollapsibleSection>
      </div>

      {/* Items bulk import modal */}
      {itemBulkDiff && (
        <BulkImportModal
          diff={itemBulkDiff}
          importing={itemImporting}
          onConfirm={handleConfirmItemImport}
          onCancel={() => setItemBulkDiff(null)}
        />
      )}

      {/* Items table */}
      <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              {(
                [
                  ["item_code", "Item Code"],
                  ["item_name", "Name"],
                  ["manufacturer", "Manufacturer"],
                  ["category", "Category"],
                ] as [SortColumn, string][]
              ).map(([col, label]) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-4 py-2 font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100"
                >
                  {label}
                  {sortArrow(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No items found.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => router.push(`/items/${item.id}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-4 py-2 font-medium">{item.item_code}</td>
                  <td className="px-4 py-2">{item.item_name ?? "—"}</td>
                  <td className="px-4 py-2">{item.manufacturer ?? "—"}</td>
                  <td className="px-4 py-2">{item.category ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
      />

      {/* Missing references modal for supplier upload */}
      {showMissingRefs && supplierAnalysis && (
        <MissingReferencesModal
          missingItemCodes={supplierAnalysis.missingItemCodes}
          missingCompanies={supplierAnalysis.missingCompanies}
          importing={supplierImporting}
          onSkipMissing={handleSkipMissing}
          onCreateAndImport={handleCreateAndImport}
          onCancel={() => {
            setShowMissingRefs(false);
            setSupplierRows(null);
            setSupplierAnalysis(null);
          }}
        />
      )}
    </div>
  );
}
