"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import CompanySelect from "@/components/CompanySelect";
import StatusMessage from "@/components/StatusMessage";

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

export default function ReceiptsPage() {
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [date, setDate] = useState(todayISO());
  const [lines, setLines] = useState<ReceiptLineForm[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function updateLine(
    key: string,
    field: keyof ReceiptLineForm,
    value: string
  ) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [field]: value } : l))
    );
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

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
    } else {
      setStatus({ type: "success", message: "Receipt saved." });
      setCompanyId(null);
      setDate(todayISO());
      setLines([emptyLine()]);
    }
    setSaving(false);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CompanySelect value={companyId} onChange={setCompanyId} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
                    placeholder="Item #"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
                    placeholder="0"
                    min="1"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
                    placeholder="Lot #"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
    </div>
  );
}
