"use client";

interface FollowupSuggestionsProps {
  suggestions: string[];
  onClick: (question: string) => void;
}

export default function FollowupSuggestions({
  suggestions,
  onClick,
}: FollowupSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <span className="text-xs text-slate-400 self-center">Suggested:</span>
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onClick(s)}
          className="px-3.5 py-1.5 text-xs font-medium rounded-full border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50/40 transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
