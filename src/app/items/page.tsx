"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Item } from "@/lib/types";
import StatusMessage from "@/components/StatusMessage";
import Pagination from "@/components/Pagination";
import CollapsibleSection from "@/components/CollapsibleSection";

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
      </div>

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
    </div>
  );
}
