"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Item } from "@/lib/types";
import StatusMessage from "@/components/StatusMessage";
import Pagination from "@/components/Pagination";

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
