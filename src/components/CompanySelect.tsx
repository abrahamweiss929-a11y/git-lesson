"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Company } from "@/lib/types";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";

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
          : err.message,
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
      <div className={className}>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
        <div className="flex gap-2">
          <Input
            wrapperClassName="flex-1"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New company name"
            autoFocus
            error={error || undefined}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSaveNew();
              }
              if (e.key === "Escape") handleCancelNew();
            }}
          />
          <Button
            type="button"
            onClick={handleSaveNew}
            disabled={!newName.trim()}
          >
            Save
          </Button>
          <Button variant="secondary" type="button" onClick={handleCancelNew}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Select
      label={label}
      value={value ?? ""}
      onChange={handleSelectChange}
      wrapperClassName={className}
    >
      <option value="" disabled>
        Select company…
      </option>
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
      <option value={ADD_NEW_VALUE}>+ Add new company</option>
    </Select>
  );
}
