"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import StatusMessage from "@/components/StatusMessage";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Icon from "@/components/ui/Icon";

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

  const [recentUsage, setRecentUsage] = useState<RecentUsage[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

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
      (data ?? []).map(
        (row: {
          id: number;
          item_number: string;
          lot_number: string;
          parts_used: number;
          date: string;
        }) => ({
          id: row.id,
          item_number: row.item_number,
          lot_number: row.lot_number,
          parts_used: row.parts_used,
          date: row.date,
        }),
      ),
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
    <div className="px-8 py-8 max-w-3xl">
      {status && (
        <div className="mb-4">
          <StatusMessage
            type={status.type}
            message={status.message}
            onDismiss={() => setStatus(null)}
          />
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              ref={itemRef}
              label="Item Number"
              value={itemNumber}
              onChange={(e) => setItemNumber(e.target.value)}
              placeholder="Item #"
              className="font-mono"
            />
            <Input
              label="Lot Number"
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              placeholder="Lot #"
              className="font-mono"
            />
            <Input
              label="Parts Used"
              type="number"
              inputMode="numeric"
              value={partsUsed}
              onChange={(e) => setPartsUsed(e.target.value)}
              min="1"
            />
            <Input
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              loading={saving}
              disabled={!itemNumber.trim() || !lotNumber.trim()}
              icon="check"
            >
              Record Usage
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Recent usage
          </h2>
          <span className="text-xs text-slate-500">
            Last 48 hours
            {recentUsage.length > 0 ? ` · ${recentUsage.length} entries` : ""}
          </span>
        </div>
        {deleteError && (
          <div className="mb-4">
            <StatusMessage
              type="error"
              message={`Delete failed: ${deleteError}`}
              onDismiss={() => setDeleteError(null)}
            />
          </div>
        )}
        {loadingRecent ? (
          <Card className="text-sm text-slate-500">Loading…</Card>
        ) : recentUsage.length === 0 ? (
          <Card className="text-sm text-slate-500">
            No usage entries in the last 48 hours.
          </Card>
        ) : (
          <Card padded={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70 text-slate-500 text-xs border-b border-slate-200">
                  <tr className="text-left">
                    <th className="font-semibold uppercase tracking-wider px-5 py-3">
                      Date
                    </th>
                    <th className="font-semibold uppercase tracking-wider px-5 py-3">
                      Item #
                    </th>
                    <th className="font-semibold uppercase tracking-wider px-5 py-3">
                      Lot #
                    </th>
                    <th className="font-semibold uppercase tracking-wider px-5 py-3 text-right">
                      Parts used
                    </th>
                    <th className="px-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentUsage.map((u) => (
                    <tr
                      key={u.id}
                      className="group hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-5 py-3 text-slate-700 tabular-nums">
                        {u.date}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-900">
                        {u.item_number}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-700">
                        {u.lot_number}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold text-slate-900">
                        {u.parts_used}
                      </td>
                      <td className="px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(u)}
                          className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete usage entry"
                          aria-label="Delete usage entry"
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
