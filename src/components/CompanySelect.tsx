"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Company } from "@/lib/types";

const ADD_NEW_VALUE = "__add_new__";

interface CompanySelectProps {
  value: number | null;
  onChange: (companyId: number) => void;
  label?: string;
  refreshKey?: number;
  className?: string;
}

export default function CompanySelect({
  value,
  onChange,
  label = "Company",
  refreshKey,
  className,
}: CompanySelectProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  const fetchCompanies = useCallback(async () => {
    const { data } = await supabase
      .from("company")
      .select("*")
      .order("name");
    if (data) setCompanies(data);
  }, []);

  useEffect(() => {
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCompanies, refreshKey]);

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === ADD_NEW_VALUE) {
      setAdding(true);
      setNewName("");
      setError("");
    } else if (val) {
      onChange(Number(val));
    }
  }

  async function handleSaveNew() {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setError("");
    const { data, error: err } = await supabase
      .from("company")
      .insert({ name: trimmed })
      .select()
      .single();

    if (err) {
      setError(
        err.message.includes("duplicate")
          ? `"${trimmed}" already exists.`
          : err.message
      );
      return;
    }

    await fetchCompanies();
    onChange(data.id);
    setAdding(false);
    setNewName("");
  }

  function handleCancelNew() {
    setAdding(false);
    setNewName("");
    setError("");
  }

  if (adding) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New company name"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSaveNew();
              }
              if (e.key === "Escape") handleCancelNew();
            }}
          />
          <button
            type="button"
            onClick={handleSaveNew}
            disabled={!newName.trim()}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleCancelNew}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        value={value ?? ""}
        onChange={handleSelectChange}
        className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white ${className ?? ""}`}
      >
        <option value="" disabled>
          Select company...
        </option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value={ADD_NEW_VALUE}>+ Add new company</option>
      </select>
    </div>
  );
}
