"use client";

import Icon, { type IconName } from "@/components/ui/Icon";

interface ExampleQuestion {
  q: string;
  icon: IconName;
  color: "teal" | "rose" | "amber" | "violet";
}

const EXAMPLE_QUESTIONS: ExampleQuestion[] = [
  { q: "How many items do we have?", icon: "package", color: "teal" },
  { q: "What expires in 60 days?", icon: "clock", color: "rose" },
  { q: "Top 5 suppliers by orders", icon: "usage", color: "amber" },
  { q: "Items missing manufacturer", icon: "warning", color: "violet" },
];

const colorClasses: Record<ExampleQuestion["color"], string> = {
  teal: "bg-teal-50 text-teal-600",
  rose: "bg-rose-50 text-rose-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
};

interface EmptyStateProps {
  onSelectExample: (question: string) => void;
}

export default function EmptyState({ onSelectExample }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <div
        className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5 text-white shadow-xl shadow-amber-500/25"
        style={{ background: "linear-gradient(135deg, #0D9488 0%, #F59E0B 100%)" }}
      >
        <Icon name="sparkle" size={26} />
      </div>
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
        Ask anything about your inventory.
      </h2>
      <p className="text-slate-500 mt-3 max-w-md mx-auto text-sm">
        Natural-language queries across orders, receipts, usage, and the item
        master. Answers come back as tables you can export.
      </p>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
        {EXAMPLE_QUESTIONS.map((e) => (
          <button
            key={e.q}
            onClick={() => onSelectExample(e.q)}
            className="group flex items-center gap-3 text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-teal-300 hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorClasses[e.color]}`}
            >
              <Icon name={e.icon} size={18} />
            </div>
            <div className="text-sm font-medium text-slate-900 group-hover:text-teal-800 flex-1">
              {e.q}
            </div>
            <Icon
              name="arrow"
              size={14}
              className="text-slate-300 group-hover:text-teal-600 shrink-0"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
