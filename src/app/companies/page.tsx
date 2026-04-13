"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Company } from "@/lib/types";
import StatusMessage from "@/components/StatusMessage";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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

      {companies.length === 0 ? (
        <p className="text-sm text-gray-500">No companies yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {companies.map((c) => (
            <li key={c.id} className="px-4 py-3 text-sm">
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
