"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import StatusMessage from "@/components/StatusMessage";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function UsagePage() {
  const [itemNumber, setItemNumber] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [partsUsed, setPartsUsed] = useState("1");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const itemRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!itemNumber.trim() || !lotNumber.trim()) return;

    setSaving(true);
    setStatus(null);

    const { error } = await supabase.from("usage").insert({
      item_number: itemNumber.trim(),
      lot_number: lotNumber.trim(),
      parts_used: parseInt(partsUsed) || 1,
      date,
    });

    if (error) {
      setStatus({ type: "error", message: error.message });
    } else {
      setStatus({ type: "success", message: "Usage recorded." });
      setItemNumber("");
      setLotNumber("");
      setPartsUsed("1");
      // Keep date for rapid re-entry
      itemRef.current?.focus();
    }
    setSaving(false);
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-6">Record Usage</h1>

      {status && (
        <div className="mb-4">
          <StatusMessage
            type={status.type}
            message={status.message}
            onDismiss={() => setStatus(null)}
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Number
          </label>
          <input
            ref={itemRef}
            type="text"
            value={itemNumber}
            onChange={(e) => setItemNumber(e.target.value)}
            placeholder="Item #"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lot Number
          </label>
          <input
            type="text"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
            placeholder="Lot #"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Parts Used
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={partsUsed}
            onChange={(e) => setPartsUsed(e.target.value)}
            min="1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>

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

        <button
          type="submit"
          disabled={saving || !itemNumber.trim() || !lotNumber.trim()}
          className="w-full rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Record Usage"}
        </button>
      </form>
    </div>
  );
}
