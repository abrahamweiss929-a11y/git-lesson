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

interface OrderLineForm {
  key: string;
  item_number: string;
  quantity_boxes: string;
  price: string;
}

function emptyLine(): OrderLineForm {
  return {
    key: crypto.randomUUID(),
    item_number: "",
    quantity_boxes: "",
    price: "",
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// v5: Recent order row with file count
interface RecentOrder {
  id: number;
  date: string;
  company_name: string;
  line_count: number;
  file_count: number;
}

export default function OrdersPage() {
  // --- v1 form state (unchanged defaults) ---
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [date, setDate] = useState(todayISO());
  const [lines, setLines] = useState<OrderLineForm[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // --- AI state ---
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

  // --- v5: Recent orders list ---
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // --- v5: Attachment modal ---
  const [modalTarget, setModalTarget] = useState<{
    id: number;
    label: string;
  } | null>(null);

  const fetchRecentOrders = useCallback(async () => {
    setLoadingRecent(true);
    const { data: orders } = await supabase
      .from("purchase_order")
      .select("id, date, company:company_id(name)")
      .order("created_at", { ascending: false })
      .limit(25);

    if (!orders || orders.length === 0) {
      setRecentOrders([]);
      setLoadingRecent(false);
      return;
    }

    const orderIds = orders.map((o: { id: number }) => o.id);

    const [{ data: lineCounts }, { data: fileCounts }] = await Promise.all([
      supabase
        .from("purchase_order_line")
        .select("purchase_order_id")
        .in("purchase_order_id", orderIds),
      supabase
        .from("purchase_order_source_document")
        .select("purchase_order_id")
        .in("purchase_order_id", orderIds),
    ]);

    const lineMap = new Map<number, number>();
    (lineCounts ?? []).forEach((row: { purchase_order_id: number }) => {
      lineMap.set(
        row.purchase_order_id,
        (lineMap.get(row.purchase_order_id) ?? 0) + 1
      );
    });

    const fileMap = new Map<number, number>();
    (fileCounts ?? []).forEach((row: { purchase_order_id: number }) => {
      fileMap.set(
        row.purchase_order_id,
        (fileMap.get(row.purchase_order_id) ?? 0) + 1
      );
    });

    const rows: RecentOrder[] = orders.map(
      (o: { id: number; date: string; company: { name: string } | { name: string }[] | null }) => {
        // Supabase types the joined relation as an array; FK points to a single row.
        const companyName = Array.isArray(o.company)
          ? (o.company[0]?.name ?? "Unknown")
          : (o.company?.name ?? "Unknown");
        return {
          id: o.id,
          date: o.date,
          company_name: companyName,
          line_count: lineMap.get(o.id) ?? 0,
          file_count: fileMap.get(o.id) ?? 0,
        };
      }
    );

    setRecentOrders(rows);
    setLoadingRecent(false);
  }, []);

  useEffect(() => {
    fetchRecentOrders();
  }, [fetchRecentOrders]);

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
  function updateLine(key: string, field: keyof OrderLineForm, value: string) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [field]: value } : l))
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
      const newLines: OrderLineForm[] = result.line_items.map((item) => {
        const key = crypto.randomUUID();
        if (item.item_number) newAiFields.add(`line:${key}:item_number`);
        if (item.quantity_boxes !== 0)
          newAiFields.add(`line:${key}:quantity_boxes`);
        if (item.price != null && item.price !== 0)
          newAiFields.add(`line:${key}:price`);
        return {
          key,
          item_number: item.item_number || "",
          quantity_boxes:
            item.quantity_boxes !== 0 ? String(item.quantity_boxes) : "",
          price:
            item.price != null && item.price !== 0
              ? String(item.price)
              : "",
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
      (l) => l.item_number.trim() && l.quantity_boxes.trim()
    );
    if (validLines.length === 0) return;

    setSaving(true);
    setStatus(null);

    const { data: order, error: orderErr } = await supabase
      .from("purchase_order")
      .insert({ company_id: companyId, date })
      .select()
      .single();

    if (orderErr) {
      setStatus({ type: "error", message: orderErr.message });
      setSaving(false);
      return;
    }

    const { error: linesErr } = await supabase
      .from("purchase_order_line")
      .insert(
        validLines.map((l) => ({
          purchase_order_id: order.id,
          item_number: l.item_number.trim(),
          quantity_boxes: parseInt(l.quantity_boxes),
          price: l.price.trim() ? parseFloat(l.price) : null,
        }))
      );

    if (linesErr) {
      setStatus({
        type: "error",
        message: `Order created but lines failed: ${linesErr.message}`,
      });
      setSaving(false);
      return;
    }

    // v5: Link source documents to order
    if (sourceDocumentIds.length > 0) {
      const { error: linkErr } = await supabase
        .from("purchase_order_source_document")
        .insert(
          sourceDocumentIds.map((docId) => ({
            purchase_order_id: order.id,
            source_document_id: docId,
          }))
        );

      if (linkErr) {
        setStatus({
          type: "error",
          message: `Order saved but file linking failed: ${linkErr.message}`,
        });
        setSaving(false);
        fetchRecentOrders();
        return;
      }
    }

    setStatus({ type: "success", message: "Order saved." });
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
    // Refresh recent orders
    fetchRecentOrders();
    setSaving(false);
  }

  return (
    <VerificationLayout uploadedFiles={uploadedFiles}>
      <h1 className="text-xl font-bold mb-6">New Order</h1>

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
          context="order"
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
                className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end"
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
                    Qty (boxes)
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
                    Price
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={line.price}
                    onChange={(e) =>
                      updateLine(line.key, "price", e.target.value)
                    }
                    onFocus={() =>
                      handleAiFocus(`line:${line.key}:price`)
                    }
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none ${aiFieldClass(`line:${line.key}:price`)}`}
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
          {saving ? "Saving..." : "Save Order"}
        </button>
      </form>

      {/* v5: Recent Orders list */}
      <div className="mt-10 border-t pt-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Recent Orders
        </h2>
        {loadingRecent ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : recentOrders.length === 0 ? (
          <p className="text-sm text-gray-500">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4 font-medium">ID</th>
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Supplier</th>
                  <th className="pb-2 pr-4 font-medium">Lines</th>
                  <th className="pb-2 font-medium">Files</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-2 pr-4 text-gray-600">#{o.id}</td>
                    <td className="py-2 pr-4 text-gray-700">{o.date}</td>
                    <td className="py-2 pr-4 text-gray-700">
                      {o.company_name}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">{o.line_count}</td>
                    <td className="py-2">
                      <FileBadge
                        count={o.file_count}
                        onClick={() =>
                          setModalTarget({
                            id: o.id,
                            label: `Order #${o.id}`,
                          })
                        }
                      />
                      {o.file_count === 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setModalTarget({
                              id: o.id,
                              label: `Order #${o.id}`,
                            })
                          }
                          className="text-xs text-gray-400 hover:text-blue-600"
                        >
                          Attach
                        </button>
                      )}
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
          context="order"
          label={modalTarget.label}
          onClose={() => {
            setModalTarget(null);
            fetchRecentOrders();
          }}
        />
      )}
    </VerificationLayout>
  );
}
