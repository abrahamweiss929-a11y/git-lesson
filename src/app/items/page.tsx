"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Item } from "@/lib/types";
import StatusMessage from "@/components/StatusMessage";
import Pagination from "@/components/Pagination";
import CollapsibleSection from "@/components/CollapsibleSection";
import BulkImportModal from "@/components/BulkImportModal";
import MissingReferencesModal from "@/components/MissingReferencesModal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import Badge, { type BadgeColor } from "@/components/ui/Badge";
import {
  downloadItemTemplate,
  downloadSupplierTemplate,
} from "@/lib/generate-item-template";
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

function categoryBadgeColor(cat: string | null): BadgeColor {
  if (!cat) return "slate";
  const lc = cat.toLowerCase();
  if (lc.includes("chem")) return "teal";
  if (lc.includes("hema")) return "violet";
  if (lc.includes("consum")) return "sky";
  if (lc.includes("immuno")) return "amber";
  if (lc.includes("micro")) return "emerald";
  return "slate";
}

function categoryIconBg(cat: string | null): string {
  const color = categoryBadgeColor(cat);
  return {
    teal: "bg-teal-50 text-teal-600",
    violet: "bg-violet-50 text-violet-600",
    sky: "bg-sky-50 text-sky-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
    slate: "bg-slate-100 text-slate-500",
  }[color];
}

export default function ItemsPage() {
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>("item_code");
  const [sortDirection, setSortDirection] = useState<SortDir>("asc");

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

  const itemFileInputRef = useRef<HTMLInputElement>(null);
  const [itemBulkDiff, setItemBulkDiff] = useState<ImportDiff | null>(null);
  const [itemImporting, setItemImporting] = useState(false);

  const supplierFileInputRef = useRef<HTMLInputElement>(null);
  const [supplierRows, setSupplierRows] = useState<ParsedSupplierRow[] | null>(
    null,
  );
  const [supplierAnalysis, setSupplierAnalysis] =
    useState<SupplierImportAnalysis | null>(null);
  const [supplierImporting, setSupplierImporting] = useState(false);
  const [showMissingRefs, setShowMissingRefs] = useState(false);

  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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
        `item_code.ilike.%${escaped}%,item_name.ilike.%${escaped}%`,
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

  function SortHeader({ col, label }: { col: SortColumn; label: string }) {
    const active = col === sortColumn;
    return (
      <th
        onClick={() => handleSort(col)}
        className="font-semibold uppercase tracking-wider px-5 py-3 cursor-pointer select-none hover:text-slate-700 transition-colors"
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active && (
            <Icon
              name={sortDirection === "asc" ? "sortUp" : "sortDown"}
              size={12}
              className="text-slate-500"
            />
          )}
        </span>
      </th>
    );
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
      parts_per_box: addForm.parts_per_box
        ? parseInt(addForm.parts_per_box)
        : null,
      tests_per_box: addForm.tests_per_box
        ? parseInt(addForm.tests_per_box)
        : null,
      shelf_life_days: addForm.shelf_life_days
        ? parseInt(addForm.shelf_life_days)
        : null,
      test_type: addForm.test_type.trim() || null,
      machine: addForm.machine.trim() || null,
      item_type: addForm.item_type.trim() || null,
      category: addForm.category.trim() || null,
      storage_requirements: addForm.storage_requirements.trim() || null,
      average_order_qty: addForm.average_order_qty
        ? parseInt(addForm.average_order_qty)
        : null,
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
      fetchItems();
    }
    setSaving(false);
  }

  async function handleItemFileSelected(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (itemFileInputRef.current) itemFileInputRef.current.value = "";
    setStatus(null);

    const result = await parseItemSpreadsheet(file);
    if (!result.success) {
      setStatus({ type: "error", message: result.error });
      return;
    }

    const { data: allItems } = await supabase
      .from("item")
      .select("id, item_code");
    const diff = diffWithExisting(result.rows, allItems ?? []);
    if (diff.toInsert.length === 0 && diff.toUpdate.length === 0) {
      setStatus({
        type: "error",
        message: "No new or updated items found in file.",
      });
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
          })),
        );
        if (error) {
          setStatus({
            type: "error",
            message: `Insert failed: ${error.message}`,
          });
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
              .eq("id", row.existingId),
          ),
        );

        const firstError = updateResults.find((r) => r.error);
        if (firstError?.error) {
          setStatus({
            type: "error",
            message: `Some updates failed: ${firstError.error.message}`,
          });
          setItemImporting(false);
          setItemBulkDiff(null);
          fetchItems();
          return;
        }
      }

      const added = itemBulkDiff.toInsert.length;
      const updated = itemBulkDiff.toUpdate.length;
      const parts = [];
      if (added > 0)
        parts.push(`${added} item${added !== 1 ? "s" : ""} added`);
      if (updated > 0)
        parts.push(`${updated} item${updated !== 1 ? "s" : ""} updated`);
      setStatus({
        type: "success",
        message: `Import complete — ${parts.join(", ")}.`,
      });
      setItemBulkDiff(null);
      fetchItems();
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Import failed.",
      });
      setItemBulkDiff(null);
      fetchItems();
    } finally {
      setItemImporting(false);
    }
  }

  async function handleSupplierFileSelected(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (supplierFileInputRef.current) supplierFileInputRef.current.value = "";
    setStatus(null);

    const result = await parseSupplierSpreadsheet(file);
    if (!result.success) {
      setStatus({ type: "error", message: result.error });
      return;
    }

    const [{ data: allItems }, { data: allCompanies }] = await Promise.all([
      supabase.from("item").select("id, item_code"),
      supabase.from("company").select("id, name"),
    ]);

    const analysis = analyzeSupplierImport(
      result.rows,
      allItems ?? [],
      allCompanies ?? [],
    );

    setSupplierRows(result.rows);
    setSupplierAnalysis(analysis);

    if (
      analysis.missingItemCodes.length > 0 ||
      analysis.missingCompanies.length > 0
    ) {
      setShowMissingRefs(true);
    } else {
      await executeSupplierImport(analysis.readyToImport);
    }
  }

  async function executeSupplierImport(
    rows: SupplierImportAnalysis["readyToImport"],
  ) {
    if (rows.length === 0) {
      setStatus({
        type: "error",
        message: "No valid supplier rows to import.",
      });
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
          last_price_update:
            row.price != null ? new Date().toISOString() : null,
        })),
        { onConflict: "item_id,company_id" },
      );

      if (error) {
        setStatus({
          type: "error",
          message: `Supplier import failed: ${error.message}`,
        });
      } else {
        setStatus({
          type: "success",
          message: `Supplier import complete — ${rows.length} record${rows.length !== 1 ? "s" : ""} imported.`,
        });
      }
    } catch (err) {
      setStatus({
        type: "error",
        message:
          err instanceof Error ? err.message : "Supplier import failed.",
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
      if (supplierAnalysis.missingCompanies.length > 0) {
        const { error } = await supabase
          .from("company")
          .insert(supplierAnalysis.missingCompanies.map((name) => ({ name })));
        if (error) {
          setStatus({
            type: "error",
            message: `Failed to create companies: ${error.message}`,
          });
          setSupplierImporting(false);
          return;
        }
      }

      if (supplierAnalysis.missingItemCodes.length > 0) {
        const { error } = await supabase.from("item").insert(
          supplierAnalysis.missingItemCodes.map((code) => ({
            item_code: code,
          })),
        );
        if (error) {
          setStatus({
            type: "error",
            message: `Failed to create items: ${error.message}`,
          });
          setSupplierImporting(false);
          return;
        }
      }

      const [{ data: allItems }, { data: allCompanies }] = await Promise.all([
        supabase.from("item").select("id, item_code"),
        supabase.from("company").select("id, name"),
      ]);

      const newAnalysis = analyzeSupplierImport(
        supplierRows,
        allItems ?? [],
        allCompanies ?? [],
      );

      await executeSupplierImport(newAnalysis.readyToImport);
      fetchItems();
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
    <div className="px-8 py-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
            Catalog
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Items
          </h2>
          <p className="text-sm text-slate-500 mt-1 tabular-nums">
            {totalCount} item{totalCount !== 1 ? "s" : ""} in system
          </p>
        </div>
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

      {/* Filter strip */}
      <Card padded={false} className="mb-5 p-4">
        <Input
          icon="search"
          placeholder="Search by item code or name…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search items"
        />
      </Card>

      {/* Collapsible sections */}
      <div className="space-y-2 mb-6">
        <CollapsibleSection title="Add single item manually">
          <form onSubmit={handleAddItem} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input
                label="Item Code *"
                value={addForm.item_code}
                onChange={(e) =>
                  setAddForm({ ...addForm, item_code: e.target.value })
                }
                className="font-mono"
              />
              <Input
                label="Item Name"
                value={addForm.item_name}
                onChange={(e) =>
                  setAddForm({ ...addForm, item_name: e.target.value })
                }
              />
              <Input
                label="Manufacturer"
                value={addForm.manufacturer}
                onChange={(e) =>
                  setAddForm({ ...addForm, manufacturer: e.target.value })
                }
              />
              <Input
                label="Parts per Box"
                type="number"
                inputMode="numeric"
                value={addForm.parts_per_box}
                onChange={(e) =>
                  setAddForm({ ...addForm, parts_per_box: e.target.value })
                }
                min="1"
              />
              <Input
                label="Tests per Box"
                type="number"
                inputMode="numeric"
                value={addForm.tests_per_box}
                onChange={(e) =>
                  setAddForm({ ...addForm, tests_per_box: e.target.value })
                }
                min="1"
              />
              <Input
                label="Shelf Life (days)"
                type="number"
                inputMode="numeric"
                value={addForm.shelf_life_days}
                onChange={(e) =>
                  setAddForm({ ...addForm, shelf_life_days: e.target.value })
                }
                min="1"
              />
              <Input
                label="Test Type"
                placeholder="e.g. HbA1c"
                value={addForm.test_type}
                onChange={(e) =>
                  setAddForm({ ...addForm, test_type: e.target.value })
                }
              />
              <Input
                label="Machine"
                placeholder="e.g. DxC 700 AU"
                value={addForm.machine}
                onChange={(e) =>
                  setAddForm({ ...addForm, machine: e.target.value })
                }
              />
              <Input
                label="Item Type"
                placeholder="Reagent / calibrator / etc."
                value={addForm.item_type}
                onChange={(e) =>
                  setAddForm({ ...addForm, item_type: e.target.value })
                }
              />
              <Input
                label="Category"
                placeholder="Chemistry / hematology / etc."
                value={addForm.category}
                onChange={(e) =>
                  setAddForm({ ...addForm, category: e.target.value })
                }
              />
              <Input
                label="Storage Requirements"
                placeholder="Refrigerated / frozen / room temp"
                value={addForm.storage_requirements}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    storage_requirements: e.target.value,
                  })
                }
              />
              <Input
                label="Average Order Qty"
                type="number"
                inputMode="numeric"
                value={addForm.average_order_qty}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    average_order_qty: e.target.value,
                  })
                }
                min="1"
              />
              <Textarea
                wrapperClassName="sm:col-span-2 lg:col-span-3"
                label="Notes"
                rows={2}
                value={addForm.notes}
                onChange={(e) =>
                  setAddForm({ ...addForm, notes: e.target.value })
                }
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={addForm.manufacturer_verified}
                  onChange={(e) =>
                    setAddForm({
                      ...addForm,
                      manufacturer_verified: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                Manufacturer Verified
              </label>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                loading={saving}
                disabled={!addForm.item_code.trim()}
                icon="check"
              >
                Save Item
              </Button>
            </div>
          </form>
        </CollapsibleSection>

        <CollapsibleSection title="Bulk upload items (Excel)">
          <div className="flex gap-3 pt-2 flex-wrap">
            <Button
              variant="secondary"
              icon="download"
              onClick={downloadItemTemplate}
            >
              Download template
            </Button>
            <Button
              icon="upload"
              onClick={() => itemFileInputRef.current?.click()}
            >
              Upload items
            </Button>
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
          <div className="flex gap-3 pt-2 flex-wrap">
            <Button
              variant="secondary"
              icon="download"
              onClick={downloadSupplierTemplate}
            >
              Download supplier template
            </Button>
            <Button
              icon="upload"
              onClick={() => supplierFileInputRef.current?.click()}
            >
              Upload suppliers
            </Button>
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

      {itemBulkDiff && (
        <BulkImportModal
          diff={itemBulkDiff}
          importing={itemImporting}
          onConfirm={handleConfirmItemImport}
          onCancel={() => setItemBulkDiff(null)}
        />
      )}

      {/* Items table */}
      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70 text-slate-500 text-xs border-b border-slate-200">
              <tr className="text-left">
                <SortHeader col="item_code" label="Item" />
                <SortHeader col="manufacturer" label="Manufacturer" />
                <SortHeader col="category" label="Category" />
                <th className="font-semibold uppercase tracking-wider px-5 py-3 text-right">
                  Shelf life
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    No items found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => router.push(`/items/${item.id}`)}
                    className="cursor-pointer hover:bg-slate-50/60 group transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${categoryIconBg(item.category)}`}
                        >
                          <Icon name="flask" size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-mono text-xs font-semibold text-slate-900">
                            {item.item_code}
                          </div>
                          <div className="text-sm text-slate-600 truncate">
                            {item.item_name ?? "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {item.manufacturer ?? "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      {item.category ? (
                        <Badge color={categoryBadgeColor(item.category)}>
                          {item.category}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-slate-600">
                      {item.shelf_life_days != null
                        ? `${item.shelf_life_days}d`
                        : "—"}
                    </td>
                    <td className="px-3 text-right">
                      <Icon
                        name="chevronRight"
                        size={14}
                        className="text-slate-300 group-hover:text-slate-500 transition-colors inline-block"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
      />

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
