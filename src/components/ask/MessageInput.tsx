"use client";

import { useRef, useEffect } from "react";
import Icon from "@/components/ui/Icon";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}

export default function MessageInput({
  value,
  onChange,
  onSubmit,
  disabled,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSubmit();
      }
    }
  }

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="px-6 pb-6 pt-2 shrink-0">
      <div className="max-w-4xl mx-auto">
        <div className="relative rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_-10px_rgba(15,23,42,0.15)] focus-within:border-teal-400 focus-within:ring-4 focus-within:ring-teal-500/10 transition-all">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your inventory…"
            disabled={disabled}
            rows={1}
            className="w-full resize-none bg-transparent outline-none px-5 py-4 pr-16 text-sm text-slate-900 placeholder:text-slate-400 disabled:text-slate-400"
          />
          <button
            onClick={onSubmit}
            disabled={!canSend}
            aria-label="Send"
            className="absolute right-3 bottom-3 w-9 h-9 rounded-lg flex items-center justify-center text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-500/25"
            style={{
              background: "linear-gradient(135deg, #0D9488 0%, #F59E0B 100%)",
              boxShadow: "0 4px 14px -2px rgba(245,158,11,0.45)",
            }}
          >
            <Icon name="send" size={16} />
          </button>
        </div>
        <div className="text-[11px] text-slate-400 text-center mt-2">
          Ask can make mistakes — verify critical data against source documents.
        </div>
      </div>
    </div>
  );
}
