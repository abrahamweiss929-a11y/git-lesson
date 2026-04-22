"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import StatusMessage from "@/components/StatusMessage";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface RecentUsage {
  id: number;
  item_number: string;
  lot_number: string;
  parts_used: number;
  date: string;
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

  // --- Recent usage (last 48 hours) ---
  const [recentUsage, setRecentUsage] = useState<RecentUsage[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // --- Delete state ---
  const [deleteTarget, setDeleteTarget] = useState<RecentUsage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchRecentUsage = useCallback(async () => {
    setLoadingRecent(true);
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 48);
    const cutoffISO = cutoff.toISOString();

    const { data } = await supabase
      .from("usage")
      .select("id, item_number, lot_number, parts_used, date, created_at")
      .gte("created_at", cutoffISO)
      .order("created_at", { ascending: false });

    setRecentUsage(
      (data ?? []).map((row: { id: number; item_number: string; lot_number: string; parts_used: number; date: string }) => ({
        id: row.id,
        item_number: row.item_number,
        lot_number: row.lot_number,
        parts_used: row.parts_used,
        date: row.date,
      }))
    );
    setLoadingRecent(false);
  }, []);

  useEffect(() => {
    fetchRecentUsage();
  }, [fetchRecentUsage]);

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
      itemRef.current?.focus();
      fetchRecentUsage();
    }
    setSaving(false);
  }

  async function handleDeleteUsage() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase
      .from("usage")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      setDeleteError(error.message);
      setDeleting(false);
      return;
    }
    setDeleteTarget(null);
    setDeleting(false);
    fetchRecentUsage();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
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

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
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

      {/* Recent Usage (last 48 hours) */}
      <div className="mt-10 border-t pt-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Recent Usage (last 48 hours)
        </h2>
        {deleteError && (
          <div className="mb-3">
            <StatusMessage
              type="error"
              message={`Delete failed: ${deleteError}`}
              onDismiss={() => setDeleteError(null)}
            />
          </div>
        )}
        {loadingRecent ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : recentUsage.length === 0 ? (
          <p className="text-sm text-gray-500">
            No usage entries in the last 48 hours.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Item Number</th>
                  <th className="pb-2 pr-4 font-medium">Lot Number</th>
                  <th className="pb-2 pr-4 font-medium">Parts Used</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {recentUsage.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-2 pr-4 text-gray-700">{u.date}</td>
                    <td className="py-2 pr-4 text-gray-700">
                      {u.item_number}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {u.lot_number}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {u.parts_used}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(u)}
                        className="text-gray-400 hover:text-red-600 text-sm"
                        title="Delete usage entry"
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

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          title="Delete this usage entry?"
          details={[
            { label: "Item", value: deleteTarget.item_number },
            { label: "Lot", value: deleteTarget.lot_number },
            { label: "Parts used", value: String(deleteTarget.parts_used) },
            { label: "Date", value: deleteTarget.date },
          ]}
          deleting={deleting}
          onConfirm={handleDeleteUsage}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
