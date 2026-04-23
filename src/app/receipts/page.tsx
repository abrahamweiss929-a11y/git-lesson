"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ExtractDocumentResponse } from "@/lib/extract-document.types";
import CompanySelect from "@/components/CompanySelect";
import StatusMessage from "@/components/StatusMessage";
import DocumentUpload from "@/components/DocumentUpload";
import type { UploadedFileInfo } from "@/components/DocumentUpload";
import CompanyMatchBanner from "@/components/CompanyMatchBanner";
import AiFieldCounter from "@/components/AiFieldCounter";
import VerificationLayout from "@/components/VerificationLayout";
import FileBadge from "@/components/FileBadge";
import AttachmentModal from "@/components/AttachmentModal";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Icon from "@/components/ui/Icon";

interface ReceiptLineForm {
  key: string;
  item_number: string;
  quantity_boxes: string;
  lot_number: string;
  expiration_date: string;
}

function emptyLine(): ReceiptLineForm {
  return {
    key: crypto.randomUUID(),
    item_number: "",
    quantity_boxes: "",
    lot_number: "",
    expiration_date: "",
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface RecentReceipt {
  id: number;
  date: string;
  company_name: string;
  line_count: number;
  file_count: number;
}

export default function ReceiptsPage() {
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [date, setDate] = useState(todayISO());
  const [lines, setLines] = useState<ReceiptLineForm[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [extractionResult, setExtractionResult] =
    useState<ExtractDocumentResponse | null>(null);
  const [companyWarning, setCompanyWarning] = useState<{
    rawName: string;
  } | null>(null);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const [companyRefreshKey, setCompanyRefreshKey] = useState(0);

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);
  const [sourceDocumentIds, setSourceDocumentIds] = useState<number[]>([]);

  const [recentReceipts, setRecentReceipts] = useState<RecentReceipt[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const [modalTarget, setModalTarget] = useState<{
    id: number;
    label: string;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<RecentReceipt | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchRecentReceipts = useCallback(async () => {
    setLoadingRecent(true);
    const { data: receipts } = await supabase
      .from("receipt")
      .select("id, date, company:company_id(name)")
      .order("created_at", { ascending: false })
      .limit(25);

    if (!receipts || receipts.length === 0) {
      setRecentReceipts([]);
      setLoadingRecent(false);
      return;
    }

    const receiptIds = receipts.map((r: { id: number }) => r.id);

    const [{ data: lineCounts }, { data: fileCounts }] = await Promise.all([
      supabase
        .from("receipt_line")
        .select("receipt_id")
        .in("receipt_id", receiptIds),
      supabase
        .from("receipt_source_document")
        .select("receipt_id")
        .in("receipt_id", receiptIds),
    ]);

    const lineMap = new Map<number, number>();
    (lineCounts ?? []).forEach((row: { receipt_id: number }) => {
      lineMap.set(row.receipt_id, (lineMap.get(row.receipt_id) ?? 0) + 1);
    });

    const fileMap = new Map<number, number>();
    (fileCounts ?? []).forEach((row: { receipt_id: number }) => {
      fileMap.set(row.receipt_id, (fileMap.get(row.receipt_id) ?? 0) + 1);
    });

    const rows: RecentReceipt[] = receipts.map(
      (r: {
        id: number;
        date: string;
        company: { name: string } | { name: string }[] | null;
      }) => {
        const companyName = Array.isArray(r.company)
          ? (r.company[0]?.name ?? "Unknown")
          : (r.company?.name ?? "Unknown");
        return {
          id: r.id,
          date: r.date,
          company_name: companyName,
          line_count: lineMap.get(r.id) ?? 0,
          file_count: fileMap.get(r.id) ?? 0,
        };
      },
    );

    setRecentReceipts(rows);
    setLoadingRecent(false);
  }, []);

  useEffect(() => {
    fetchRecentReceipts();
  }, [fetchRecentReceipts]);

  useEffect(() => {
    return () => {
      uploadedFiles.forEach((f) => URL.revokeObjectURL(f.objectUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAiFocus(fieldId: string) {
    setAiFilledFields((prev) => {
      if (!prev.has(fieldId)) return prev;
      const next = new Set(prev);
      next.delete(fieldId);
      return next;
    });
  }

  function updateLine(
    key: string,
    field: keyof ReceiptLineForm,
    value: string,
  ) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)),
    );
    setAiFilledFields((prev) => {
      const id = `line:${key}:${field}`;
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
    setAiFilledFields((prev) => {
      const next = new Set(prev);
      for (const id of prev) {
        if (id.startsWith(`line:${key}:`)) next.delete(id);
      }
      return next.size !== prev.size ? next : prev;
    });
  }

  function handleExtracted(result: ExtractDocumentResponse) {
    setExtractionResult(result);
    const newAiFields = new Set<string>();

    if (result.company_match) {
      setCompanyId(result.company_match.id);
      newAiFields.add("company");
      setCompanyWarning(null);
    } else if (result.company_name_raw) {
      setCompanyWarning({ rawName: result.company_name_raw });
    }

    if (result.date) {
      setDate(result.date);
      newAiFields.add("date");
    }

    if (result.line_items.length > 0) {
      const newLines: ReceiptLineForm[] = result.line_items.map((item) => {
        const key = crypto.randomUUID();
        if (item.item_number) newAiFields.add(`line:${key}:item_number`);
        if (item.quantity_boxes !== 0)
          newAiFields.add(`line:${key}:quantity_boxes`);
        if (item.lot_number) newAiFields.add(`line:${key}:lot_number`);
        if (item.expiration_date)
          newAiFields.add(`line:${key}:expiration_date`);
        return {
          key,
          item_number: item.item_number || "",
          quantity_boxes:
            item.quantity_boxes !== 0 ? String(item.quantity_boxes) : "",
          lot_number: item.lot_number || "",
          expiration_date: item.expiration_date || "",
        };
      });
      setLines(newLines);
    }

    setAiFilledFields(newAiFields);
  }

  async function handleAddCompany(name: string) {
    const { data, error } = await supabase
      .from("company")
      .insert({ name: name.trim() })
      .select()
      .single();

    if (error) {
      setStatus({ type: "error", message: error.message });
      return;
    }

    setCompanyId(data.id);
    setCompanyRefreshKey((k) => k + 1);
    setCompanyWarning(null);
    setAiFilledFields((prev) => {
      const next = new Set(prev);
      next.add("company");
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;

    const validLines = lines.filter(
      (l) =>
        l.item_number.trim() &&
        l.quantity_boxes.trim() &&
        l.lot_number.trim(),
    );
    if (validLines.length === 0) return;

    setSaving(true);
    setStatus(null);

    const { data: receipt, error: receiptErr } = await supabase
      .from("receipt")
      .insert({ company_id: companyId, date })
      .select()
      .single();

    if (receiptErr) {
      setStatus({ type: "error", message: receiptErr.message });
      setSaving(false);
      return;
    }

    const { error: linesErr } = await supabase.from("receipt_line").insert(
      validLines.map((l) => ({
        receipt_id: receipt.id,
        item_number: l.item_number.trim(),
        quantity_boxes: parseInt(l.quantity_boxes),
        lot_number: l.lot_number.trim(),
        expiration_date: l.expiration_date || null,
      })),
    );

    if (linesErr) {
      setStatus({
        type: "error",
        message: `Receipt created but lines failed: ${linesErr.message}`,
      });
      setSaving(false);
      return;
    }

    if (sourceDocumentIds.length > 0) {
      const { error: linkErr } = await supabase
        .from("receipt_source_document")
        .insert(
          sourceDocumentIds.map((docId) => ({
            receipt_id: receipt.id,
            source_document_id: docId,
          })),
        );

      if (linkErr) {
        setStatus({
          type: "error",
          message: `Receipt saved but file linking failed: ${linkErr.message}`,
        });
        setSaving(false);
        fetchRecentReceipts();
        return;
      }
    }

    setStatus({ type: "success", message: "Receipt saved." });
    setCompanyId(null);
    setDate(todayISO());
    setLines([emptyLine()]);
    setExtractionResult(null);
    setCompanyWarning(null);
    setAiFilledFields(new Set());
    uploadedFiles.forEach((f) => URL.revokeObjectURL(f.objectUrl));
    setUploadedFiles([]);
    setSourceDocumentIds([]);
    fetchRecentReceipts();
    setSaving(false);
  }

  async function handleDeleteReceipt() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase
      .from("receipt")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      setDeleteError(error.message);
      setDeleting(false);
      return;
    }
    setDeleteTarget(null);
    setDeleting(false);
    fetchRecentReceipts();
  }

  return (
    <VerificationLayout uploadedFiles={uploadedFiles}>
      {status && (
        <div className="mb-4">
          <StatusMessage
            type={status.type}
            message={status.message}
            onDismiss={() => setStatus(null)}
          />
        </div>
      )}

      <div className="mb-5">
        <DocumentUpload
          onExtracted={handleExtracted}
          onFilesReady={setUploadedFiles}
          onSourceDocumentIds={setSourceDocumentIds}
          disabled={saving}
          context="receipt"
        />
      </div>

      {companyWarning && (
        <div className="mb-5">
          <CompanyMatchBanner
            rawName={companyWarning.rawName}
            onAddNew={handleAddCompany}
            onPickDifferent={() => setCompanyWarning(null)}
            onIgnore={() => setCompanyWarning(null)}
          />
        </div>
      )}

      {extractionResult?.confidence_notes && (
        <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
            <Icon name="info" size={14} />
          </div>
          <div className="flex-1">
            <span className="font-semibold">AI noted:</span>{" "}
            {extractionResult.confidence_notes}
          </div>
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CompanySelect
              value={companyId}
              onChange={(id) => {
                setCompanyId(id);
                handleAiFocus("company");
                setCompanyWarning(null);
              }}
              refreshKey={companyRefreshKey}
            />
            <Input
              label="Date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                handleAiFocus("date");
              }}
              onFocus={() => handleAiFocus("date")}
              aiFilled={aiFilledFields.has("date")}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">
                Line items
              </label>
              <button
                type="button"
                onClick={() => setLines([...lines, emptyLine()])}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 transition-colors"
              >
                <Icon name="plus" size={12} /> Add line
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line) => {
                const itemKey = `line:${line.key}:item_number`;
                const qtyKey = `line:${line.key}:quantity_boxes`;
                const lotKey = `line:${line.key}:lot_number`;
                const expKey = `line:${line.key}:expiration_date`;
                const anyAi =
                  aiFilledFields.has(itemKey) ||
                  aiFilledFields.has(qtyKey) ||
                  aiFilledFields.has(lotKey) ||
                  aiFilledFields.has(expKey);
                return (
                  <div
                    key={line.key}
                    className={`rounded-xl border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-[1.4fr_70px_1fr_1fr_36px] gap-2 items-end ${anyAi ? "bg-amber-50/40" : "bg-white"}`}
                  >
                    <Input
                      label="Item #"
                      value={line.item_number}
                      onChange={(e) =>
                        updateLine(line.key, "item_number", e.target.value)
                      }
                      onFocus={() => handleAiFocus(itemKey)}
                      placeholder="Item #"
                      aiFilled={aiFilledFields.has(itemKey)}
                      className="font-mono"
                    />
                    <Input
                      label="Qty"
                      type="number"
                      inputMode="numeric"
                      value={line.quantity_boxes}
                      onChange={(e) =>
                        updateLine(line.key, "quantity_boxes", e.target.value)
                      }
                      onFocus={() => handleAiFocus(qtyKey)}
                      placeholder="0"
                      min="1"
                      aiFilled={aiFilledFields.has(qtyKey)}
                    />
                    <Input
                      label="Lot #"
                      value={line.lot_number}
                      onChange={(e) =>
                        updateLine(line.key, "lot_number", e.target.value)
                      }
                      onFocus={() => handleAiFocus(lotKey)}
                      placeholder="Lot #"
                      aiFilled={aiFilledFields.has(lotKey)}
                    />
                    <Input
                      label="Expiration"
                      type="date"
                      value={line.expiration_date}
                      onChange={(e) =>
                        updateLine(line.key, "expiration_date", e.target.value)
                      }
                      onFocus={() => handleAiFocus(expKey)}
                      aiFilled={aiFilledFields.has(expKey)}
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      disabled={lines.length <= 1}
                      aria-label="Remove line"
                      className="rounded-md p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 transition-colors h-10 flex items-center justify-center"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
            {aiFilledFields.size > 0 && (
              <div className="mt-3">
                <AiFieldCounter count={aiFilledFields.size} />
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <Button type="submit" loading={saving} disabled={!companyId} icon="check">
              Save Receipt
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Recent receipts
          </h2>
          {recentReceipts.length > 0 && (
            <span className="text-xs text-slate-500 tabular-nums">
              {recentReceipts.length} shown
            </span>
          )}
        </div>
        {loadingRecent ? (
          <Card className="text-sm text-slate-500">Loading…</Card>
        ) : recentReceipts.length === 0 ? (
          <Card className="text-sm text-slate-500">No receipts yet.</Card>
        ) : (
          <Card padded={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70 text-slate-500 text-xs border-b border-slate-200">
                  <tr className="text-left">
                    <th className="font-semibold uppercase tracking-wider px-5 py-3">
                      ID
                    </th>
                    <th className="font-semibold uppercase tracking-wider px-5 py-3">
                      Date
                    </th>
                    <th className="font-semibold uppercase tracking-wider px-5 py-3">
                      Supplier
                    </th>
                    <th className="font-semibold uppercase tracking-wider px-5 py-3 text-right">
                      Lines
                    </th>
                    <th className="font-semibold uppercase tracking-wider px-5 py-3">
                      Files
                    </th>
                    <th className="px-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentReceipts.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/60 group transition-colors"
                    >
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">
                        #{r.id}
                      </td>
                      <td className="px-5 py-3 text-slate-700 tabular-nums">
                        {r.date}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                            {r.company_name
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((w) => w[0])
                              .join("")
                              .toUpperCase() || "—"}
                          </div>
                          <span className="font-medium text-slate-900">
                            {r.company_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                        {r.line_count}
                      </td>
                      <td className="px-5 py-3">
                        {r.file_count > 0 ? (
                          <FileBadge
                            count={r.file_count}
                            onClick={() =>
                              setModalTarget({
                                id: r.id,
                                label: `Receipt #${r.id}`,
                              })
                            }
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setModalTarget({
                                id: r.id,
                                label: `Receipt #${r.id}`,
                              })
                            }
                            className="text-xs font-medium text-slate-400 hover:text-teal-700 transition-colors"
                          >
                            Attach
                          </button>
                        )}
                      </td>
                      <td className="px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(r)}
                          className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete receipt"
                          aria-label={`Delete receipt ${r.id}`}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {modalTarget && (
        <AttachmentModal
          targetId={modalTarget.id}
          context="receipt"
          label={modalTarget.label}
          onClose={() => {
            setModalTarget(null);
            fetchRecentReceipts();
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title={`Delete receipt #${deleteTarget.id}?`}
          details={[
            { label: "Supplier", value: deleteTarget.company_name },
            { label: "Date", value: deleteTarget.date },
            { label: "Line items", value: String(deleteTarget.line_count) },
          ]}
          deleting={deleting}
          onConfirm={handleDeleteReceipt}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError(null);
          }}
        />
      )}
      {deleteError && (
        <div className="mt-2">
          <StatusMessage
            type="error"
            message={`Delete failed: ${deleteError}`}
            onDismiss={() => setDeleteError(null)}
          />
        </div>
      )}
    </VerificationLayout>
  );
}
