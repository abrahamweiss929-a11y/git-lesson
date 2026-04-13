"use client";

import { useEffect } from "react";

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

  return (
    <div
      className={`rounded-md p-3 text-sm ${
        type === "success"
          ? "bg-green-50 border border-green-200 text-green-800"
          : "bg-red-50 border border-red-200 text-red-800"
      }`}
    >
      {message}
    </div>
  );
}
