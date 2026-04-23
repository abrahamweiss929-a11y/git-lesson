"use client";

import { useEffect } from "react";
import Icon from "@/components/ui/Icon";

interface StatusMessageProps {
  type: "success" | "error";
  message: string;
  onDismiss: () => void;
}

export default function StatusMessage({
  type,
  message,
  onDismiss,
}: StatusMessageProps) {
  useEffect(() => {
    if (type === "success") {
      const timer = setTimeout(onDismiss, 3000);
      return () => clearTimeout(timer);
    }
  }, [type, onDismiss]);

  const isSuccess = type === "success";

  return (
    <div
      role={isSuccess ? "status" : "alert"}
      className={`rounded-xl p-4 text-sm flex items-start gap-3 ${
        isSuccess
          ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
          : "bg-rose-50 border border-rose-200 text-rose-900"
      }`}
    >
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white ${
          isSuccess ? "bg-emerald-500" : "bg-rose-500"
        }`}
      >
        <Icon name={isSuccess ? "check" : "warning"} size={14} />
      </div>
      <div className="flex-1 min-w-0 pt-0.5 font-medium">{message}</div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className={`shrink-0 rounded-md p-1 transition-colors ${
          isSuccess
            ? "text-emerald-700 hover:bg-emerald-100"
            : "text-rose-700 hover:bg-rose-100"
        }`}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
