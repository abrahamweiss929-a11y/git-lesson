import type { HTMLAttributes } from "react";

export type BadgeColor =
  | "slate"
  | "teal"
  | "amber"
  | "rose"
  | "emerald"
  | "violet"
  | "sky";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor;
  dot?: boolean;
}

const colorClasses: Record<BadgeColor, string> = {
  slate: "bg-slate-100 text-slate-700 border border-slate-200/60",
  teal: "bg-teal-50 text-teal-700 border border-teal-200/50",
  amber: "bg-amber-50 text-amber-700 border border-amber-200/50",
  rose: "bg-rose-50 text-rose-700 border border-rose-200/50",
  emerald: "bg-emerald-50 text-emerald-700 border border-emerald-200/50",
  violet: "bg-violet-50 text-violet-700 border border-violet-200/50",
  sky: "bg-sky-50 text-sky-700 border border-sky-200/50",
};

const dotClasses: Record<BadgeColor, string> = {
  slate: "bg-slate-400",
  teal: "bg-teal-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  sky: "bg-sky-500",
};

export default function Badge({
  color = "slate",
  dot,
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colorClasses[color]} ${className}`}
      {...rest}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotClasses[color]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
