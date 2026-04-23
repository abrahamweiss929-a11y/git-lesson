"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Company } from "@/lib/types";
import StatusMessage from "@/components/StatusMessage";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Icon from "@/components/ui/Icon";

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
    if ((receiptCount ?? 0) > 0)
      refs.push(`${receiptCount} receipt${receiptCount === 1 ? "" : "s"}`);
    if ((orderCount ?? 0) > 0)
      refs.push(`${orderCount} order${orderCount === 1 ? "" : "s"}`);
    if ((supplierCount ?? 0) > 0)
      refs.push(
        `${supplierCount} item-supplier link${supplierCount === 1 ? "" : "s"}`,
      );

    if (refs.length > 0) {
      setBlockMessage(
        `This company can't be deleted.\n\nIt's referenced by:\n${refs.map((r) => `• ${r}`).join("\n")}\n\nRemove those records first, then try again.`,
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
    <div className="px-8 py-8 max-w-3xl">
      <form onSubmit={handleSubmit} className="mb-6">
        <Card className="flex items-end gap-3">
          <Input
            wrapperClassName="flex-1"
            label="Add a company"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Beckman Coulter"
            icon="building"
          />
          <Button
            type="submit"
            loading={saving}
            disabled={!name.trim()}
            icon="plus"
          >
            Add Company
          </Button>
        </Card>
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
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900 whitespace-pre-line">
          {blockMessage}
          <button
            type="button"
            onClick={() => setBlockMessage(null)}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {companies.length === 0 ? (
        <Card className="text-sm text-slate-500">No companies yet.</Card>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              All companies
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {companies.length} total
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {companies.map((c) => (
              <li
                key={c.id}
                className="px-5 py-3 text-sm flex items-center justify-between group hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                    <Icon name="building" size={14} />
                  </div>
                  <span className="font-medium text-slate-900 truncate">
                    {c.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteClick(c)}
                  disabled={checkingRefs}
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete company"
                  aria-label={`Delete ${c.name}`}
                >
                  <Icon name="trash" size={14} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

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
