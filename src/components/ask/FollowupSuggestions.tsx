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
    <div className="flex flex-wrap gap-2">
      <span className="text-xs text-gray-400 self-center">Suggested:</span>
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onClick(s)}
          className="px-2.5 py-1 rounded-full border border-gray-200 bg-white text-xs text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
