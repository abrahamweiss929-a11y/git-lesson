"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import type { ToolUsedEntry } from "@/lib/ask/types";

interface DetailsPanelProps {
  toolsUsed: ToolUsedEntry[];
  sqlUsed?: string;
}

export default function DetailsPanel({
  toolsUsed,
  sqlUsed,
}: DetailsPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="text-xs">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 transition-colors font-medium"
      >
        <span
          className={`inline-flex transition-transform ${
            open ? "rotate-90" : ""
          }`}
          aria-hidden="true"
        >
          <Icon name="chevronRight" size={10} />
        </span>
        {open ? "Hide details" : "Show details"}
      </button>

      {open && (
        <div className="mt-2 space-y-3 pl-4 border-l-2 border-slate-200">
          <div>
            <div className="font-semibold text-slate-500 mb-1.5 uppercase tracking-wider text-[10px]">
              Tools used
            </div>
            <ul className="space-y-1.5">
              {toolsUsed.map((t, i) => (
                <li key={i} className="text-slate-600">
                  <span className="font-mono bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded">
                    {t.name}
                  </span>
                  {t.input && Object.keys(t.input).length > 0 && (
                    <span className="text-slate-400 ml-1">
                      (
                      {Object.entries(t.input)
                        .map(
                          ([k, v]) =>
                            `${k}: ${typeof v === "string" ? `"${v}"` : JSON.stringify(v)}`,
                        )
                        .join(", ")}
                      )
                    </span>
                  )}
                  <span className="text-slate-400 ml-1">
                    → {t.result_summary}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {sqlUsed && (
            <div>
              <div className="font-semibold text-slate-500 mb-1.5 uppercase tracking-wider text-[10px]">
                SQL executed
              </div>
              <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto text-[11px] text-slate-700 whitespace-pre-wrap font-mono">
                {sqlUsed}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
