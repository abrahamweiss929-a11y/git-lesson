"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Item, ItemSupplierWithCompany } from "@/lib/types";
import CompanySelect from "@/components/CompanySelect";
import StatusMessage from "@/components/StatusMessage";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Icon from "@/components/ui/Icon";

function escapeIlike(s: string): string {
  return s.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-200">
        <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
          {title}
        </h3>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<
    ReturnType<typeof itemToForm> | null
  >(null);
  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [suppliers, setSuppliers] = useState<ItemSupplierWithCompany[]>([]);
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(
    null,
  );
  const [editSupplierData, setEditSupplierData] = useState({
    their_item_code: "",
    price: "",
    currency: "USD",
    notes: "",
  });

  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    company_id: null as number | null,
    their_item_code: "",
    price: "",
    currency: "USD",
    notes: "",
  });
  const [addingSupplier, setAddingSupplier] = useState(false);

  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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

  async function handleDelete() {
    if (!item) return;
    setDeleting(true);
    setStatus(null);

    const escaped = escapeIlike(item.item_code);

    const [{ count: receiptCount }, { count: orderCount }] = await Promise.all(
      [
        supabase
          .from("receipt_line")
          .select("id", { count: "exact", head: true })
          .ilike("item_number", escaped),
        supabase
          .from("purchase_order_line")
          .select("id", { count: "exact", head: true })
          .ilike("item_number", escaped),
      ],
    );

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

    await supabase.from("item_supplier").delete().eq("item_id", item.id);

    const { error } = await supabase.from("item").delete().eq("id", item.id);

    if (error) {
      setStatus({ type: "error", message: error.message });
      setDeleting(false);
      setDeleteConfirm(false);
    } else {
      router.push("/items");
    }
  }

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

  if (loading) {
    return (
      <div className="px-8 py-8 max-w-3xl text-slate-500">Loading…</div>
    );
  }

  if (notFound || !item) {
    return (
      <div className="px-8 py-8 max-w-3xl">
        <p className="text-slate-500">Item not found.</p>
        <Link
          href="/items"
          className="text-teal-700 hover:text-teal-800 text-sm mt-3 inline-flex items-center gap-1"
        >
          <Icon name="chevronLeft" size={14} /> Back to Items
        </Link>
      </div>
    );
  }

  const isEditing = editing && formData;

  return (
    <div className="px-8 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <Link
          href="/items"
          className="text-sm text-slate-600 hover:text-teal-700 inline-flex items-center gap-1 transition-colors"
        >
          <Icon name="chevronLeft" size={14} /> Back to Items
        </Link>
        <div className="flex gap-2 flex-wrap">
          {!editing && !deleteConfirm && (
            <>
              <Button variant="secondary" onClick={startEdit}>
                Edit
              </Button>
              <Button
                variant="secondary"
                onClick={() => setDeleteConfirm(true)}
                className="!border-rose-200 !text-rose-600 hover:!bg-rose-50 hover:!border-rose-300"
              >
                Delete
              </Button>
            </>
          )}
          {!editing && deleteConfirm && (
            <>
              <Button
                variant="danger"
                onClick={handleDelete}
                loading={deleting}
              >
                Confirm delete
              </Button>
              <Button
                variant="secondary"
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
            </>
          )}
          {editing && (
            <>
              <Button
                onClick={saveEdit}
                loading={saving}
                disabled={!formData?.item_code.trim()}
                icon="check"
              >
                Save
              </Button>
              <Button
                variant="secondary"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="mb-5">
        <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
          Item
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1 font-mono">
          {item.item_code}
        </h2>
        {item.item_name && (
          <p className="text-sm text-slate-600 mt-1">{item.item_name}</p>
        )}
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

      <div className="space-y-4">
        {/* Basic Info */}
        <Section title="Basic info">
          {isEditing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                wrapperClassName="sm:col-span-2"
                label="Item Code *"
                className="font-mono"
                value={formData.item_code}
                onChange={(e) =>
                  setFormData({ ...formData, item_code: e.target.value })
                }
              />
              <Input
                label="Item Name"
                value={formData.item_name}
                onChange={(e) =>
                  setFormData({ ...formData, item_name: e.target.value })
                }
              />
              <Input
                label="Manufacturer"
                value={formData.manufacturer}
                onChange={(e) =>
                  setFormData({ ...formData, manufacturer: e.target.value })
                }
              />
              <label className="flex items-center gap-2 text-sm text-slate-700 mt-1 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={formData.manufacturer_verified}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      manufacturer_verified: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                Manufacturer Verified
              </label>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
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
              <Input
                label="Item Type"
                placeholder="Reagent / calibrator / control / etc."
                value={formData.item_type}
                onChange={(e) =>
                  setFormData({ ...formData, item_type: e.target.value })
                }
              />
              <Input
                label="Category"
                placeholder="Chemistry / hematology / etc."
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
              />
              <Input
                label="Test Type"
                placeholder="e.g. HbA1c"
                value={formData.test_type}
                onChange={(e) =>
                  setFormData({ ...formData, test_type: e.target.value })
                }
              />
              <Input
                label="Machine"
                placeholder="e.g. DxC 700 AU"
                value={formData.machine}
                onChange={(e) =>
                  setFormData({ ...formData, machine: e.target.value })
                }
              />
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
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
              <Input
                label="Parts per Box"
                type="number"
                inputMode="numeric"
                value={formData.parts_per_box}
                onChange={(e) =>
                  setFormData({ ...formData, parts_per_box: e.target.value })
                }
                min="1"
              />
              <Input
                label="Tests per Box"
                type="number"
                inputMode="numeric"
                value={formData.tests_per_box}
                onChange={(e) =>
                  setFormData({ ...formData, tests_per_box: e.target.value })
                }
                min="1"
              />
              <Input
                label="Shelf Life (days)"
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
              />
              <Input
                label="Storage Requirements"
                placeholder="Refrigerated / frozen / room temp"
                value={formData.storage_requirements}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    storage_requirements: e.target.value,
                  })
                }
              />
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
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
                  item.shelf_life_days ? `${item.shelf_life_days} days` : null
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
              <Input
                label="Average Order Qty"
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
              />
              <Textarea
                wrapperClassName="sm:col-span-2"
                label="Notes"
                rows={3}
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
              />
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
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
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500 text-xs border-b border-slate-200">
                  <tr>
                    <th className="px-5 pb-2 font-semibold uppercase tracking-wider">
                      Supplier
                    </th>
                    <th className="px-5 pb-2 font-semibold uppercase tracking-wider">
                      Their code
                    </th>
                    <th className="px-5 pb-2 font-semibold uppercase tracking-wider text-right">
                      Price
                    </th>
                    <th className="px-5 pb-2 font-semibold uppercase tracking-wider">
                      Last updated
                    </th>
                    <th className="px-5 pb-2 font-semibold uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suppliers.map((s) =>
                    editingSupplierId === s.id ? (
                      <tr key={s.id}>
                        <td className="px-5 py-3 text-sm font-medium text-slate-900">
                          {s.company.name}
                        </td>
                        <td className="px-5 py-3">
                          <Input
                            wrapperClassName="min-w-[120px]"
                            value={editSupplierData.their_item_code}
                            onChange={(e) =>
                              setEditSupplierData({
                                ...editSupplierData,
                                their_item_code: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td className="px-5 py-3">
                          <Input
                            wrapperClassName="w-28"
                            type="number"
                            step="0.01"
                            value={editSupplierData.price}
                            onChange={(e) =>
                              setEditSupplierData({
                                ...editSupplierData,
                                price: e.target.value,
                              })
                            }
                            className="text-right tabular-nums"
                          />
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-500">—</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => saveEditSupplier(s)}
                              className="text-teal-700 hover:text-teal-800 text-sm font-semibold transition-colors"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSupplierId(null)}
                              className="text-slate-500 hover:text-slate-700 text-sm transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="px-5 py-3 text-sm font-medium text-slate-900">
                          {s.company.name}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-700 font-mono">
                          {s.their_item_code || "—"}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-700 text-right tabular-nums">
                          {s.price != null
                            ? `$${Number(s.price).toFixed(2)}`
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-500 tabular-nums">
                          {s.last_price_update
                            ? new Date(s.last_price_update).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex gap-3 justify-end">
                            <button
                              type="button"
                              onClick={() => startEditSupplier(s)}
                              className="text-teal-700 hover:text-teal-800 text-sm font-semibold transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSupplier(s.id)}
                              className="text-rose-600 hover:text-rose-700 text-sm font-medium transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No suppliers linked yet.</p>
          )}

          {!showAddSupplier ? (
            <div className="mt-4">
              <Button
                variant="secondary"
                icon="plus"
                onClick={() => setShowAddSupplier(true)}
              >
                Add supplier
              </Button>
            </div>
          ) : (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">
                Add supplier
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CompanySelect
                  value={newSupplier.company_id}
                  onChange={(id) =>
                    setNewSupplier({ ...newSupplier, company_id: id })
                  }
                  label="Supplier"
                />
                <Input
                  label="Their Item Code"
                  placeholder="Blank if same as manufacturer code"
                  value={newSupplier.their_item_code}
                  onChange={(e) =>
                    setNewSupplier({
                      ...newSupplier,
                      their_item_code: e.target.value,
                    })
                  }
                  className="font-mono"
                />
                <Input
                  label="Price"
                  type="number"
                  step="0.01"
                  value={newSupplier.price}
                  onChange={(e) =>
                    setNewSupplier({
                      ...newSupplier,
                      price: e.target.value,
                    })
                  }
                />
                <Input
                  label="Currency"
                  value={newSupplier.currency}
                  onChange={(e) =>
                    setNewSupplier({
                      ...newSupplier,
                      currency: e.target.value,
                    })
                  }
                />
                <Input
                  wrapperClassName="sm:col-span-2"
                  label="Notes"
                  value={newSupplier.notes}
                  onChange={(e) =>
                    setNewSupplier({
                      ...newSupplier,
                      notes: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleAddSupplier}
                  loading={addingSupplier}
                  disabled={!newSupplier.company_id}
                  icon="check"
                >
                  Add
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowAddSupplier(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
