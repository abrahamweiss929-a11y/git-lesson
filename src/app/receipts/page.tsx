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

// v5: Recent receipt row with file count
interface RecentReceipt {
  id: number;
  date: string;
  company_name: string;
  line_count: number;
  file_count: number;
}

export default function ReceiptsPage() {
  // --- v1 form state (unchanged defaults) ---
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [date, setDate] = useState(todayISO());
  const [lines, setLines] = useState<ReceiptLineForm[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // --- v2 AI state ---
  const [extractionResult, setExtractionResult] =
    useState<ExtractDocumentResponse | null>(null);
  const [companyWarning, setCompanyWarning] = useState<{
    rawName: string;
  } | null>(null);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(
    new Set()
  );
  const [companyRefreshKey, setCompanyRefreshKey] = useState(0);

  // --- Document viewer state ---
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);

  // --- v5: Source document tracking ---
  const [sourceDocumentIds, setSourceDocumentIds] = useState<number[]>([]);

  // --- v5: Recent receipts list ---
  const [recentReceipts, setRecentReceipts] = useState<RecentReceipt[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // --- v5: Attachment modal ---
  const [modalTarget, setModalTarget] = useState<{
    id: number;
    label: string;
  } | null>(null);

  // --- Delete state ---
  const [deleteTarget, setDeleteTarget] = useState<RecentReceipt | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchRecentReceipts = useCallback(async () => {
    setLoadingRecent(true);
    // Fetch last 25 receipts with company name, line count, and file count
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

    // Get line counts and file counts for these receipts
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

    // Count per receipt
    const lineMap = new Map<number, number>();
    (lineCounts ?? []).forEach((row: { receipt_id: number }) => {
      lineMap.set(row.receipt_id, (lineMap.get(row.receipt_id) ?? 0) + 1);
    });

    const fileMap = new Map<number, number>();
    (fileCounts ?? []).forEach((row: { receipt_id: number }) => {
      fileMap.set(row.receipt_id, (fileMap.get(row.receipt_id) ?? 0) + 1);
    });

    const rows: RecentReceipt[] = receipts.map(
      (r: { id: number; date: string; company: { name: string } | { name: string }[] | null }) => {
        // Supabase types the joined relation as an array; FK points to a single row.
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
      }
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

  // --- Helpers for AI highlighting ---
  function aiFieldClass(fieldId: string): string {
    return aiFilledFields.has(fieldId)
      ? "bg-[#FEF9E7] transition-colors duration-300"
      : "";
  }

  function handleAiFocus(fieldId: string) {
    setAiFilledFields((prev) => {
      if (!prev.has(fieldId)) return prev;
      const next = new Set(prev);
      next.delete(fieldId);
      return next;
    });
  }

  // --- Line item management ---
  function updateLine(
    key: string,
    field: keyof ReceiptLineForm,
    value: string
  ) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [field]: value } : l))
    );
    // Clear AI highlight for this field
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
    // Remove all AI highlights for this line
    setAiFilledFields((prev) => {
      const next = new Set(prev);
      for (const id of prev) {
        if (id.startsWith(`line:${key}:`)) next.delete(id);
      }
      return next.size !== prev.size ? next : prev;
    });
  }

  // --- AI extraction callback ---
  function handleExtracted(result: ExtractDocumentResponse) {
    setExtractionResult(result);
    const newAiFields = new Set<string>();

    // Company
    if (result.company_match) {
      setCompanyId(result.company_match.id);
      newAiFields.add("company");
      setCompanyWarning(null);
    } else if (result.company_name_raw) {
      setCompanyWarning({ rawName: result.company_name_raw });
    }

    // Date
    if (result.date) {
      setDate(result.date);
      newAiFields.add("date");
    }

    // Line items
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

  // --- Company match banner actions ---
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

  // --- Form submission (v1 logic + v5 source document linking) ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;

    const validLines = lines.filter(
      (l) =>
        l.item_number.trim() &&
        l.quantity_boxes.trim() &&
        l.lot_number.trim()
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
      }))
    );

    if (linesErr) {
      setStatus({
        type: "error",
        message: `Receipt created but lines failed: ${linesErr.message}`,
      });
      setSaving(false);
      return;
    }

    // v5: Link source documents to receipt
    if (sourceDocumentIds.length > 0) {
      const { error: linkErr } = await supabase
        .from("receipt_source_document")
        .insert(
          sourceDocumentIds.map((docId) => ({
            receipt_id: receipt.id,
            source_document_id: docId,
          }))
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
    // Reset AI state
    setExtractionResult(null);
    setCompanyWarning(null);
    setAiFilledFields(new Set());
    uploadedFiles.forEach((f) => URL.revokeObjectURL(f.objectUrl));
    setUploadedFiles([]);
    setSourceDocumentIds([]);
    // Refresh recent receipts
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
      <h1 className="text-xl font-bold mb-6">New Receipt</h1>

      {status && (
        <div className="mb-4">
          <StatusMessage
            type={status.type}
            message={status.message}
            onDismiss={() => setStatus(null)}
          />
        </div>
      )}

      {/* Document upload widget */}
      <div className="mb-4">
        <DocumentUpload
          onExtracted={handleExtracted}
          onFilesReady={setUploadedFiles}
          onSourceDocumentIds={setSourceDocumentIds}
          disabled={saving}
          context="receipt"
        />
      </div>

      {/* AI field counter */}
      {aiFilledFields.size > 0 && (
        <div className="mb-4">
          <AiFieldCounter count={aiFilledFields.size} />
        </div>
      )}

      {/* Company match warning */}
      {companyWarning && (
        <div className="mb-4">
          <CompanyMatchBanner
            rawName={companyWarning.rawName}
            onAddNew={handleAddCompany}
            onPickDifferent={() => setCompanyWarning(null)}
            onIgnore={() => setCompanyWarning(null)}
          />
        </div>
      )}

      {/* Confidence notes from AI */}
      {extractionResult?.confidence_notes && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          &#8505;&#65039; AI noted: {extractionResult.confidence_notes}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CompanySelect
            value={companyId}
            onChange={(id) => {
              setCompanyId(id);
              setAiFilledFields((prev) => {
                if (!prev.has("company")) return prev;
                const next = new Set(prev);
                next.delete("company");
                return next;
              });
              setCompanyWarning(null);
            }}
            refreshKey={companyRefreshKey}
            className={aiFieldClass("company")}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setAiFilledFields((prev) => {
                  if (!prev.has("date")) return prev;
                  const next = new Set(prev);
                  next.delete("date");
                  return next;
                });
              }}
              onFocus={() => handleAiFocus("date")}
              className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none ${aiFieldClass("date")}`}
            />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Line Items
          </h2>
          <div className="space-y-3">
            {lines.map((line) => (
              <div
                key={line.key}
                className="grid grid-cols-2 sm:grid-cols-[1fr_auto_1fr_1fr_auto] gap-2 items-end"
              >
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Item Number
                  </label>
                  <input
                    type="text"
                    value={line.item_number}
                    onChange={(e) =>
                      updateLine(line.key, "item_number", e.target.value)
                    }
                    onFocus={() =>
                      handleAiFocus(`line:${line.key}:item_number`)
                    }
                    placeholder="Item #"
                    className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none ${aiFieldClass(`line:${line.key}:item_number`)}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Qty
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={line.quantity_boxes}
                    onChange={(e) =>
                      updateLine(line.key, "quantity_boxes", e.target.value)
                    }
                    onFocus={() =>
                      handleAiFocus(`line:${line.key}:quantity_boxes`)
                    }
                    placeholder="0"
                    min="1"
                    className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none ${aiFieldClass(`line:${line.key}:quantity_boxes`)}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Lot Number
                  </label>
                  <input
                    type="text"
                    value={line.lot_number}
                    onChange={(e) =>
                      updateLine(line.key, "lot_number", e.target.value)
                    }
                    onFocus={() =>
                      handleAiFocus(`line:${line.key}:lot_number`)
                    }
                    placeholder="Lot #"
                    className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none ${aiFieldClass(`line:${line.key}:lot_number`)}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Expiration
                  </label>
                  <input
                    type="date"
                    value={line.expiration_date}
                    onChange={(e) =>
                      updateLine(line.key, "expiration_date", e.target.value)
                    }
                    onFocus={() =>
                      handleAiFocus(`line:${line.key}:expiration_date`)
                    }
                    className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none ${aiFieldClass(`line:${line.key}:expiration_date`)}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  disabled={lines.length <= 1}
                  className="rounded-md px-2 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setLines([...lines, emptyLine()])}
            className="mt-3 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            + Add Line
          </button>
        </div>

        <button
          type="submit"
          disabled={saving || !companyId}
          className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Receipt"}
        </button>
      </form>

      {/* v5: Recent Receipts list */}
      <div className="mt-10 border-t pt-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Recent Receipts
        </h2>
        {loadingRecent ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : recentReceipts.length === 0 ? (
          <p className="text-sm text-gray-500">No receipts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4 font-medium">ID</th>
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Supplier</th>
                  <th className="pb-2 pr-4 font-medium">Lines</th>
                  <th className="pb-2 pr-4 font-medium">Files</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {recentReceipts.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-2 pr-4 text-gray-600">#{r.id}</td>
                    <td className="py-2 pr-4 text-gray-700">{r.date}</td>
                    <td className="py-2 pr-4 text-gray-700">
                      {r.company_name}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">{r.line_count}</td>
                    <td className="py-2 pr-4">
                      <FileBadge
                        count={r.file_count}
                        onClick={() =>
                          setModalTarget({
                            id: r.id,
                            label: `Receipt #${r.id}`,
                          })
                        }
                      />
                      {r.file_count === 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setModalTarget({
                              id: r.id,
                              label: `Receipt #${r.id}`,
                            })
                          }
                          className="text-xs text-gray-400 hover:text-blue-600"
                        >
                          Attach
                        </button>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(r)}
                        className="text-gray-400 hover:text-red-600 text-sm"
                        title="Delete receipt"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* v5: Attachment modal */}
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

      {/* Delete confirmation modal */}
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
