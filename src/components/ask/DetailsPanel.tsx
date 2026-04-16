"use client";

import { useState } from "react";
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
        className="flex items-center gap-1 text-gray-400 hover:text-gray-600"
      >
        <span
          className={`inline-block transition-transform ${
            open ? "rotate-90" : ""
          }`}
        >
          &#x25B6;
        </span>
        Show details
      </button>

      {open && (
        <div className="mt-2 space-y-2 pl-4 border-l-2 border-gray-200">
          {/* Tools used */}
          <div>
            <div className="font-medium text-gray-500 mb-1">Tools used:</div>
            <ul className="space-y-1">
              {toolsUsed.map((t, i) => (
                <li key={i} className="text-gray-600">
                  <span className="font-mono bg-gray-100 px-1 rounded">
                    {t.name}
                  </span>
                  {t.input &&
                    Object.keys(t.input).length > 0 && (
                      <span className="text-gray-400 ml-1">
                        ({Object.entries(t.input)
                          .map(
                            ([k, v]) =>
                              `${k}: ${typeof v === "string" ? `"${v}"` : JSON.stringify(v)}`
                          )
                          .join(", ")})
                      </span>
                    )}
                  <span className="text-gray-400 ml-1">
                    &rarr; {t.result_summary}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* SQL used (if any) */}
          {sqlUsed && (
            <div>
              <div className="font-medium text-gray-500 mb-1">SQL executed:</div>
              <pre className="bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto text-[11px] text-gray-700 whitespace-pre-wrap">
                {sqlUsed}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
