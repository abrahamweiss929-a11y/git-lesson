import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export default function Card({
  padded = true,
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-4px_rgba(15,23,42,0.05)] ${
        padded ? "p-6" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
