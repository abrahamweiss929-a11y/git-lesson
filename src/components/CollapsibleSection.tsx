"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
      >
        <span
          className={`inline-flex text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        >
          <Icon name="chevronRight" size={14} />
        </span>
        {title}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100">{children}</div>
      )}
    </div>
  );
}
