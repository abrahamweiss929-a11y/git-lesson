"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Company } from "@/lib/types";
import StatusMessage from "@/components/StatusMessage";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // --- Delete state ---
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [blockMessage, setBlockMessage] = useState<string | null>(null);
  const [checkingRefs, setCheckingRefs] = useState(false);

  const fetchCompanies = useCallback(async () => {
    const { data } = await supabase
      .from("company")
      .select("*")
      .order("name");
    if (data) setCompanies(data);
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);
    setStatus(null);

    const { error } = await supabase.from("company").insert({ name: trimmed });

    if (error) {
      setStatus({
        type: "error",
        message: error.message.includes("duplicate")
          ? `"${trimmed}" already exists.`
          : error.message,
      });
    } else {
      setStatus({ type: "success", message: `Added "${trimmed}".` });
      setName("");
      fetchCompanies();
    }
    setSaving(false);
  }

  async function handleDeleteClick(company: Company) {
    setCheckingRefs(true);
    setBlockMessage(null);
    setDeleteError(null);

    const [{ count: receiptCount }, { count: orderCount }, { count: supplierCount }] =
      await Promise.all([
        supabase
          .from("receipt")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company.id),
        supabase
          .from("purchase_order")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company.id),
        supabase
          .from("item_supplier")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company.id),
      ]);

    setCheckingRefs(false);

    const refs: string[] = [];
    if ((receiptCount ?? 0) > 0) refs.push(`${receiptCount} receipt${receiptCount === 1 ? "" : "s"}`);
    if ((orderCount ?? 0) > 0) refs.push(`${orderCount} order${orderCount === 1 ? "" : "s"}`);
    if ((supplierCount ?? 0) > 0) refs.push(`${supplierCount} item-supplier link${supplierCount === 1 ? "" : "s"}`);

    if (refs.length > 0) {
      setBlockMessage(
        `This company can't be deleted.\n\nIt's referenced by:\n${refs.map((r) => `• ${r}`).join("\n")}\n\nRemove those records first, then try again.`
      );
      return;
    }

    setDeleteTarget(company);
  }

  async function handleDeleteCompany() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase
      .from("company")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      setDeleteError(error.message);
      setDeleting(false);
      return;
    }
    setDeleteTarget(null);
    setDeleting(false);
    fetchCompanies();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-6">Companies</h1>

      <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Company name"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add Company
        </button>
      </form>

      {status && (
        <div className="mb-4">
          <StatusMessage
            type={status.type}
            message={status.message}
            onDismiss={() => setStatus(null)}
          />
        </div>
      )}

      {deleteError && (
        <div className="mb-4">
          <StatusMessage
            type="error"
            message={`Delete failed: ${deleteError}`}
            onDismiss={() => setDeleteError(null)}
          />
        </div>
      )}

      {blockMessage && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 whitespace-pre-line">
          {blockMessage}
          <button
            type="button"
            onClick={() => setBlockMessage(null)}
            className="mt-3 block text-xs text-amber-600 hover:text-amber-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {companies.length === 0 ? (
        <p className="text-sm text-gray-500">No companies yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {companies.map((c) => (
            <li
              key={c.id}
              className="px-4 py-3 text-sm flex items-center justify-between"
            >
              <span>{c.name}</span>
              <button
                type="button"
                onClick={() => handleDeleteClick(c)}
                disabled={checkingRefs}
                className="text-gray-400 hover:text-red-600 text-sm disabled:opacity-50"
                title="Delete company"
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          title={`Delete company "${deleteTarget.name}"?`}
          details={[]}
          deleting={deleting}
          onConfirm={handleDeleteCompany}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
