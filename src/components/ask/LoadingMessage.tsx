"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";

const PHRASES = [
  "Thinking…",
  "Querying inventory…",
  "Almost there…",
  "Analyzing data…",
];

export default function LoadingMessage() {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % PHRASES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-4">
      <div
        className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white shadow-lg shadow-amber-500/20"
        style={{
          background: "linear-gradient(135deg, #0D9488 0%, #F59E0B 100%)",
        }}
      >
        <Icon name="sparkle" size={16} />
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-500 pt-3.5">
        <div className="flex gap-1.5">
          <span
            className="w-2 h-2 rounded-full bg-teal-400 animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-teal-500 animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-amber-500 animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
        <span className="ml-1">{PHRASES[phraseIndex]}</span>
      </div>
    </div>
  );
}
