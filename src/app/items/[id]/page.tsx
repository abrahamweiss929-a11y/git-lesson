"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Item, ItemSupplierWithCompany } from "@/lib/types";
import CompanySelect from "@/components/CompanySelect";
import StatusMessage from "@/components/StatusMessage";

/* ------------------------------------------------------------------ */
/*  Helper: escape % and _ for ilike exact (case-insensitive) match   */
/* ------------------------------------------------------------------ */
function escapeIlike(s: string): string {
  return s.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/* ------------------------------------------------------------------ */
/*  Empty form data factory                                            */
/* ------------------------------------------------------------------ */
function itemToForm(item: Item) {
  return {
    item_code: item.item_code,
    item_name: item.item_name ?? "",
    manufacturer: item.manufacturer ?? "",
    manufacturer_verified: item.manufacturer_verified,
    parts_per_box: item.parts_per_box?.toString() ?? "",
    tests_per_box: item.tests_per_box?.toString() ?? "",
    shelf_life_days: item.shelf_life_days?.toString() ?? "",
    test_type: item.test_type ?? "",
    machine: item.machine ?? "",
    item_type: item.item_type ?? "",
    category: item.category ?? "",
    storage_requirements: item.storage_requirements ?? "",
    average_order_qty: item.average_order_qty?.toString() ?? "",
    notes: item.notes ?? "",
  };
}

/* ------------------------------------------------------------------ */
/*  Section component for grouped fields                               */
/* ------------------------------------------------------------------ */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-md bg-white">
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Field display (view mode)                                          */
/* ------------------------------------------------------------------ */
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value || "—"}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */
export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // Item state
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<ReturnType<typeof itemToForm> | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Suppliers
  const [suppliers, setSuppliers] = useState<ItemSupplierWithCompany[]>([]);
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  const [editSupplierData, setEditSupplierData] = useState({
    their_item_code: "",
    price: "",
    currency: "USD",
    notes: "",
  });

  // Add supplier form
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    company_id: null as number | null,
    their_item_code: "",
    price: "",
    currency: "USD",
    notes: "",
  });
  const [addingSupplier, setAddingSupplier] = useState(false);

  // Status
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  /* ---- Fetch item ---- */
  const fetchItem = useCallback(async () => {
    const { data, error } = await supabase
      .from("item")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      setNotFound(true);
    } else {
      setItem(data);
    }
    setLoading(false);
  }, [id]);

  /* ---- Fetch suppliers ---- */
  const fetchSuppliers = useCallback(async () => {
    const { data } = await supabase
      .from("item_supplier")
      .select("*, company:company_id(id, name)")
      .eq("item_id", id)
      .order("created_at");
    if (data) setSuppliers(data as ItemSupplierWithCompany[]);
  }, [id]);

  useEffect(() => {
    fetchItem();
    fetchSuppliers();
  }, [fetchItem, fetchSuppliers]);

  /* ---- Edit handlers ---- */
  function startEdit() {
    if (!item) return;
    setFormData(itemToForm(item));
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setFormData(null);
  }

  async function saveEdit() {
    if (!formData || !item) return;
    setSaving(true);
    setStatus(null);

    const { error } = await supabase
      .from("item")
      .update({
        item_code: formData.item_code.trim(),
        item_name: formData.item_name.trim() || null,
        manufacturer: formData.manufacturer.trim() || null,
        manufacturer_verified: formData.manufacturer_verified,
        parts_per_box: formData.parts_per_box
          ? parseInt(formData.parts_per_box)
          : null,
        tests_per_box: formData.tests_per_box
          ? parseInt(formData.tests_per_box)
          : null,
        shelf_life_days: formData.shelf_life_days
          ? parseInt(formData.shelf_life_days)
          : null,
        test_type: formData.test_type.trim() || null,
        machine: formData.machine.trim() || null,
        item_type: formData.item_type.trim() || null,
        category: formData.category.trim() || null,
        storage_requirements: formData.storage_requirements.trim() || null,
        average_order_qty: formData.average_order_qty
          ? parseInt(formData.average_order_qty)
          : null,
        notes: formData.notes.trim() || null,
      })
      .eq("id", item.id);

    if (error) {
      setStatus({ type: "error", message: error.message });
    } else {
      setStatus({ type: "success", message: "Item updated." });
      setEditing(false);
      setFormData(null);
      fetchItem();
    }
    setSaving(false);
  }

  /* ---- Delete handlers ---- */
  async function handleDelete() {
    if (!item) return;
    setDeleting(true);
    setStatus(null);

    // Check for references in receipt_line and purchase_order_line
    const escaped = escapeIlike(item.item_code);

    const [{ count: receiptCount }, { count: orderCount }] = await Promise.all([
      supabase
        .from("receipt_line")
        .select("id", { count: "exact", head: true })
        .ilike("item_number", escaped),
      supabase
        .from("purchase_order_line")
        .select("id", { count: "exact", head: true })
        .ilike("item_number", escaped),
    ]);

    const rc = receiptCount ?? 0;
    const oc = orderCount ?? 0;

    if (rc > 0 || oc > 0) {
      const parts = [];
      if (rc > 0) parts.push(`${rc} receipt line${rc !== 1 ? "s" : ""}`);
      if (oc > 0) parts.push(`${oc} order line${oc !== 1 ? "s" : ""}`);
      setStatus({
        type: "error",
        message: `Cannot delete: this item is referenced by ${parts.join(" and ")}. Remove those records first.`,
      });
      setDeleting(false);
      setDeleteConfirm(false);
      return;
    }

    // Delete supplier links first (FK is RESTRICT)
    await supabase.from("item_supplier").delete().eq("item_id", item.id);

    // Delete the item
    const { error } = await supabase.from("item").delete().eq("id", item.id);

    if (error) {
      setStatus({ type: "error", message: error.message });
      setDeleting(false);
      setDeleteConfirm(false);
    } else {
      router.push("/items");
    }
  }

  /* ---- Supplier management ---- */
  async function handleAddSupplier() {
    if (!newSupplier.company_id || !item) return;
    setAddingSupplier(true);
    setStatus(null);

    const price = newSupplier.price ? parseFloat(newSupplier.price) : null;

    const { error } = await supabase.from("item_supplier").insert({
      item_id: item.id,
      company_id: newSupplier.company_id,
      their_item_code: newSupplier.their_item_code.trim() || null,
      price,
      currency: newSupplier.currency.trim() || "USD",
      notes: newSupplier.notes.trim() || null,
      last_price_update: price != null ? new Date().toISOString() : null,
    });

    if (error) {
      setStatus({
        type: "error",
        message: error.message.includes("duplicate")
          ? "This supplier is already linked to this item."
          : error.message,
      });
    } else {
      setNewSupplier({
        company_id: null,
        their_item_code: "",
        price: "",
        currency: "USD",
        notes: "",
      });
      setShowAddSupplier(false);
      fetchSuppliers();
    }
    setAddingSupplier(false);
  }

  function startEditSupplier(s: ItemSupplierWithCompany) {
    setEditingSupplierId(s.id);
    setEditSupplierData({
      their_item_code: s.their_item_code ?? "",
      price: s.price?.toString() ?? "",
      currency: s.currency ?? "USD",
      notes: s.notes ?? "",
    });
  }

  async function saveEditSupplier(s: ItemSupplierWithCompany) {
    setStatus(null);
    const newPrice = editSupplierData.price
      ? parseFloat(editSupplierData.price)
      : null;

    // The DB trigger handles last_price_update on update if price changes
    const { error } = await supabase
      .from("item_supplier")
      .update({
        their_item_code: editSupplierData.their_item_code.trim() || null,
        price: newPrice,
        currency: editSupplierData.currency.trim() || "USD",
        notes: editSupplierData.notes.trim() || null,
      })
      .eq("id", s.id);

    if (error) {
      setStatus({ type: "error", message: error.message });
    } else {
      setEditingSupplierId(null);
      fetchSuppliers();
    }
  }

  async function removeSupplier(supplierId: number) {
    setStatus(null);
    const { error } = await supabase
      .from("item_supplier")
      .delete()
      .eq("id", supplierId);

    if (error) {
      setStatus({ type: "error", message: error.message });
    } else {
      fetchSuppliers();
    }
  }

  /* ---- Render ---- */
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-gray-500">
        Loading...
      </div>
    );
  }

  if (notFound || !item) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-gray-500">Item not found.</p>
        <Link href="/items" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
          Back to Items
        </Link>
      </div>
    );
  }

  const isEditing = editing && formData;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <Link
          href="/items"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Items
        </Link>
        <div className="flex gap-2">
          {!editing && (
            <>
              <button
                type="button"
                onClick={startEdit}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Edit
              </button>
              {!deleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Confirm Delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(false)}
                    disabled={deleting}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
          {editing && (
            <>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving || !formData?.item_code.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Title */}
      <h1 className="text-xl font-bold text-gray-900 mb-4">
        {item.item_code}
        {item.item_name ? ` — ${item.item_name}` : ""}
      </h1>

      {status && (
        <div className="mb-4">
          <StatusMessage
            type={status.type}
            message={status.message}
            onDismiss={() => setStatus(null)}
          />
        </div>
      )}

      <div className="space-y-4">
        {/* Basic Info */}
        <Section title="Basic Info">
          {isEditing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Code *
                </label>
                <input
                  type="text"
                  value={formData.item_code}
                  onChange={(e) =>
                    setFormData({ ...formData, item_code: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  value={formData.item_name}
                  onChange={(e) =>
                    setFormData({ ...formData, item_name: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Manufacturer
                </label>
                <input
                  type="text"
                  value={formData.manufacturer}
                  onChange={(e) =>
                    setFormData({ ...formData, manufacturer: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="mfr-verified"
                  checked={formData.manufacturer_verified}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      manufacturer_verified: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="mfr-verified"
                  className="text-sm text-gray-700"
                >
                  Manufacturer Verified
                </label>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Item Code" value={item.item_code} />
              <Field label="Item Name" value={item.item_name} />
              <Field label="Manufacturer" value={item.manufacturer} />
              <Field
                label="Manufacturer Verified"
                value={item.manufacturer_verified ? "Yes" : "No"}
              />
            </dl>
          )}
        </Section>

        {/* Classification */}
        <Section title="Classification">
          {isEditing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Type
                </label>
                <input
                  type="text"
                  value={formData.item_type}
                  onChange={(e) =>
                    setFormData({ ...formData, item_type: e.target.value })
                  }
                  placeholder="Reagent / calibrator / control / etc."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  placeholder="Chemistry / hematology / etc."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Test Type
                </label>
                <input
                  type="text"
                  value={formData.test_type}
                  onChange={(e) =>
                    setFormData({ ...formData, test_type: e.target.value })
                  }
                  placeholder="e.g. HbA1c"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Machine
                </label>
                <input
                  type="text"
                  value={formData.machine}
                  onChange={(e) =>
                    setFormData({ ...formData, machine: e.target.value })
                  }
                  placeholder="e.g. DxC 700 AU"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Item Type" value={item.item_type} />
              <Field label="Category" value={item.category} />
              <Field label="Test Type" value={item.test_type} />
              <Field label="Machine" value={item.machine} />
            </dl>
          )}
        </Section>

        {/* Physical */}
        <Section title="Physical">
          {isEditing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parts per Box
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={formData.parts_per_box}
                  onChange={(e) =>
                    setFormData({ ...formData, parts_per_box: e.target.value })
                  }
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
                  value={formData.tests_per_box}
                  onChange={(e) =>
                    setFormData({ ...formData, tests_per_box: e.target.value })
                  }
                  min="1"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shelf Life (days)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={formData.shelf_life_days}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      shelf_life_days: e.target.value,
                    })
                  }
                  min="1"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Storage Requirements
                </label>
                <input
                  type="text"
                  value={formData.storage_requirements}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      storage_requirements: e.target.value,
                    })
                  }
                  placeholder="Refrigerated / frozen / room temp"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field
                label="Parts per Box"
                value={item.parts_per_box?.toString()}
              />
              <Field
                label="Tests per Box"
                value={item.tests_per_box?.toString()}
              />
              <Field
                label="Shelf Life"
                value={
                  item.shelf_life_days
                    ? `${item.shelf_life_days} days`
                    : null
                }
              />
              <Field label="Storage" value={item.storage_requirements} />
            </dl>
          )}
        </Section>

        {/* Operations */}
        <Section title="Operations">
          {isEditing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Average Order Qty
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={formData.average_order_qty}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      average_order_qty: e.target.value,
                    })
                  }
                  min="1"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field
                label="Average Order Qty"
                value={item.average_order_qty?.toString()}
              />
              <Field label="Notes" value={item.notes} />
            </dl>
          )}
        </Section>

        {/* Suppliers */}
        <Section title="Suppliers">
          {suppliers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr className="border-b border-gray-200">
                    <th className="pb-2 font-medium text-gray-600">Supplier</th>
                    <th className="pb-2 font-medium text-gray-600">
                      Their Code
                    </th>
                    <th className="pb-2 font-medium text-gray-600">Price</th>
                    <th className="pb-2 font-medium text-gray-600">
                      Last Updated
                    </th>
                    <th className="pb-2 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {suppliers.map((s) =>
                    editingSupplierId === s.id ? (
                      <tr key={s.id}>
                        <td className="py-2 pr-2 text-sm text-gray-900">
                          {s.company.name}
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            value={editSupplierData.their_item_code}
                            onChange={(e) =>
                              setEditSupplierData({
                                ...editSupplierData,
                                their_item_code: e.target.value,
                              })
                            }
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            step="0.01"
                            value={editSupplierData.price}
                            onChange={(e) =>
                              setEditSupplierData({
                                ...editSupplierData,
                                price: e.target.value,
                              })
                            }
                            className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2 text-sm text-gray-500">—</td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => saveEditSupplier(s)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSupplierId(null)}
                              className="text-gray-500 hover:text-gray-700 text-sm ml-2"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={s.id}>
                        <td className="py-2 pr-2 text-sm text-gray-900">
                          {s.company.name}
                        </td>
                        <td className="py-2 pr-2 text-sm text-gray-700">
                          {s.their_item_code || "—"}
                        </td>
                        <td className="py-2 pr-2 text-sm text-gray-700">
                          {s.price != null ? `$${Number(s.price).toFixed(2)}` : "—"}
                        </td>
                        <td className="py-2 pr-2 text-sm text-gray-500">
                          {s.last_price_update
                            ? new Date(s.last_price_update).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditSupplier(s)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSupplier(s.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No suppliers linked yet.</p>
          )}

          {/* Add supplier */}
          {!showAddSupplier ? (
            <button
              type="button"
              onClick={() => setShowAddSupplier(true)}
              className="mt-3 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              + Add Supplier
            </button>
          ) : (
            <div className="mt-3 border-t border-gray-200 pt-3">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Add Supplier
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CompanySelect
                  value={newSupplier.company_id}
                  onChange={(id) =>
                    setNewSupplier({ ...newSupplier, company_id: id })
                  }
                  label="Supplier"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Their Item Code
                  </label>
                  <input
                    type="text"
                    value={newSupplier.their_item_code}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        their_item_code: e.target.value,
                      })
                    }
                    placeholder="Blank if same as manufacturer code"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newSupplier.price}
                    onChange={(e) =>
                      setNewSupplier({ ...newSupplier, price: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <input
                    type="text"
                    value={newSupplier.currency}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        currency: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={newSupplier.notes}
                    onChange={(e) =>
                      setNewSupplier({ ...newSupplier, notes: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleAddSupplier}
                  disabled={addingSupplier || !newSupplier.company_id}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {addingSupplier ? "Adding..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSupplier(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
