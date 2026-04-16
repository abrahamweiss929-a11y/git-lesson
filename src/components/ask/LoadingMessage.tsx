"use client";

import { useEffect, useState } from "react";

const PHRASES = [
  "Thinking\u2026",
  "Querying inventory\u2026",
  "Almost there\u2026",
  "Analyzing data\u2026",
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
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-sm">
        AI
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-500 pt-1.5">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
        <span>{PHRASES[phraseIndex]}</span>
      </div>
    </div>
  );
}
