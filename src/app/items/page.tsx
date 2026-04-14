"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ItemMaster } from "@/lib/types";
import CompanySelect from "@/components/CompanySelect";
import StatusMessage from "@/components/StatusMessage";
import BulkImportModal from "@/components/BulkImportModal";
import { downloadItemTemplate } from "@/lib/generate-item-template";
import {
  parseItemSpreadsheet,
  diffWithExisting,
  type ImportDiff,
} from "@/lib/parse-item-spreadsheet";

interface SupplierCodeForm {
  key: string;
  company_id: number | null;
  their_item_number: string;
}

function emptySupplierCode(): SupplierCodeForm {
  return {
    key: crypto.randomUUID(),
    company_id: null,
    their_item_number: "",
  };
}

export default function ItemMasterPage() {
  const [internalName, setInternalName] = useState("");
  const [partsPerBox, setPartsPerBox] = useState("");
  const [testsPerBox, setTestsPerBox] = useState("");
  const [defaultShelfLife, setDefaultShelfLife] = useState("");
  const [supplierCodes, setSupplierCodes] = useState<SupplierCodeForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [existingItems, setExistingItems] = useState<ItemMaster[]>([]);

  // Bulk upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulkDiff, setBulkDiff] = useState<ImportDiff | null>(null);
  const [importing, setImporting] = useState(false);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from("item_master")
      .select("*")
      .order("internal_name");
    if (data) setExistingItems(data);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function updateSupplierCode(
    key: string,
    field: keyof SupplierCodeForm,
    value: string | number | null
  ) {
    setSupplierCodes((prev) =>
      prev.map((sc) => (sc.key === key ? { ...sc, [field]: value } : sc))
    );
  }

  function removeSupplierCode(key: string) {
    setSupplierCodes((prev) => prev.filter((sc) => sc.key !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!internalName.trim()) return;

    setSaving(true);
    setStatus(null);

    const { data: item, error: itemErr } = await supabase
      .from("item_master")
      .insert({
        internal_name: internalName.trim(),
        parts_per_box: partsPerBox ? parseInt(partsPerBox) : null,
        tests_per_box: testsPerBox ? parseInt(testsPerBox) : null,
        default_shelf_life: defaultShelfLife
          ? parseInt(defaultShelfLife)
          : null,
      })
      .select()
      .single();

    if (itemErr) {
      setStatus({ type: "error", message: itemErr.message });
      setSaving(false);
      return;
    }

    const validCodes = supplierCodes.filter(
      (sc) => sc.company_id && sc.their_item_number.trim()
    );

    if (validCodes.length > 0) {
      const { error: codesErr } = await supabase
        .from("supplier_code")
        .insert(
          validCodes.map((sc) => ({
            item_master_id: item.id,
            company_id: sc.company_id!,
            their_item_number: sc.their_item_number.trim(),
          }))
        );

      if (codesErr) {
        setStatus({
          type: "error",
          message: `Item saved but supplier codes failed: ${codesErr.message}`,
        });
        setSaving(false);
        fetchItems();
        return;
      }
    }

    setStatus({ type: "success", message: "Item saved." });
    setInternalName("");
    setPartsPerBox("");
    setTestsPerBox("");
    setDefaultShelfLife("");
    setSupplierCodes([]);
    fetchItems();
    setSaving(false);
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";

    setStatus(null);

    const result = await parseItemSpreadsheet(file);
    if (!result.success) {
      setStatus({ type: "error", message: result.error });
      return;
    }

    const diff = diffWithExisting(result.rows, existingItems);
    if (diff.toInsert.length === 0 && diff.toUpdate.length === 0) {
      setStatus({ type: "error", message: "No items found in file." });
      return;
    }

    setBulkDiff(diff);
  }

  async function handleConfirmImport() {
    if (!bulkDiff) return;

    setImporting(true);
    setStatus(null);

    try {
      // Insert new items
      if (bulkDiff.toInsert.length > 0) {
        const { error } = await supabase.from("item_master").insert(
          bulkDiff.toInsert.map((row) => ({
            internal_name: row.internal_name,
            parts_per_box: row.parts_per_box,
            tests_per_box: row.tests_per_box,
            default_shelf_life: row.default_shelf_life,
          }))
        );
        if (error) {
          setStatus({ type: "error", message: `Insert failed: ${error.message}` });
          setImporting(false);
          setBulkDiff(null);
          fetchItems();
          return;
        }
      }

      // Update existing items
      if (bulkDiff.toUpdate.length > 0) {
        const updateResults = await Promise.all(
          bulkDiff.toUpdate.map((row) =>
            supabase
              .from("item_master")
              .update({
                internal_name: row.internal_name,
                parts_per_box: row.parts_per_box,
                tests_per_box: row.tests_per_box,
                default_shelf_life: row.default_shelf_life,
              })
              .eq("id", row.existingId)
          )
        );

        const firstError = updateResults.find((r) => r.error);
        if (firstError?.error) {
          setStatus({
            type: "error",
            message: `Some updates failed: ${firstError.error.message}`,
          });
          setImporting(false);
          setBulkDiff(null);
          fetchItems();
          return;
        }
      }

      const added = bulkDiff.toInsert.length;
      const updated = bulkDiff.toUpdate.length;
      const parts = [];
      if (added > 0) parts.push(`${added} item${added !== 1 ? "s" : ""} added`);
      if (updated > 0) parts.push(`${updated} item${updated !== 1 ? "s" : ""} updated`);

      setStatus({
        type: "success",
        message: `Import complete — ${parts.join(", ")}.`,
      });
      setBulkDiff(null);
      fetchItems();
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Import failed.",
      });
      setBulkDiff(null);
      fetchItems();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-4">Item Master</h1>

      <div className="flex gap-3 mb-6">
        <button
          type="button"
          onClick={downloadItemTemplate}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Download Template
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Upload Excel
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileSelected}
        />
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Internal Name
            </label>
            <input
              type="text"
              value={internalName}
              onChange={(e) => setInternalName(e.target.value)}
              placeholder="e.g. Glucose Test Strip"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Parts per Box
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={partsPerBox}
              onChange={(e) => setPartsPerBox(e.target.value)}
              min="1"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tests per Box
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={testsPerBox}
              onChange={(e) => setTestsPerBox(e.target.value)}
              min="1"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Shelf Life (days)
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={defaultShelfLife}
              onChange={(e) => setDefaultShelfLife(e.target.value)}
              min="1"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Supplier Codes
          </h2>
          {supplierCodes.length > 0 && (
            <div className="space-y-3 mb-3">
              {supplierCodes.map((sc) => (
                <div
                  key={sc.key}
                  className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end"
                >
                  <CompanySelect
                    value={sc.company_id}
                    onChange={(id) =>
                      updateSupplierCode(sc.key, "company_id", id)
                    }
                    label="Supplier"
                  />
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Their Item #
                    </label>
                    <input
                      type="text"
                      value={sc.their_item_number}
                      onChange={(e) =>
                        updateSupplierCode(
                          sc.key,
                          "their_item_number",
                          e.target.value
                        )
                      }
                      placeholder="Supplier's item #"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSupplierCode(sc.key)}
                    className="rounded-md px-2 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() =>
              setSupplierCodes([...supplierCodes, emptySupplierCode()])
            }
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            + Add Supplier Code
          </button>
        </div>

        <button
          type="submit"
          disabled={saving || !internalName.trim()}
          className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Item"}
        </button>
      </form>

      {existingItems.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-3">Existing Items</h2>
          <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium text-gray-600">Name</th>
                  <th className="px-4 py-2 font-medium text-gray-600">
                    Parts/Box
                  </th>
                  <th className="px-4 py-2 font-medium text-gray-600">
                    Tests/Box
                  </th>
                  <th className="px-4 py-2 font-medium text-gray-600">
                    Shelf Life
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {existingItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2">{item.internal_name}</td>
                    <td className="px-4 py-2">{item.parts_per_box ?? "—"}</td>
                    <td className="px-4 py-2">{item.tests_per_box ?? "—"}</td>
                    <td className="px-4 py-2">
                      {item.default_shelf_life
                        ? `${item.default_shelf_life} days`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {bulkDiff && (
        <BulkImportModal
          diff={bulkDiff}
          importing={importing}
          onConfirm={handleConfirmImport}
          onCancel={() => setBulkDiff(null)}
        />
      )}
    </div>
  );
}
