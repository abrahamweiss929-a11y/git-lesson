"use client";

const EXAMPLE_QUESTIONS = [
  "How many items do we have?",
  "What expires in 60 days?",
  "Top 5 suppliers by orders",
  "Items missing manufacturer",
];

interface EmptyStateProps {
  onSelectExample: (question: string) => void;
}

export default function EmptyState({ onSelectExample }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">
      <h2 className="text-lg font-medium text-gray-700 mb-2">
        Ask anything about your inventory.
      </h2>
      <p className="text-sm text-gray-500 mb-6">Try asking:</p>
      <div className="flex flex-wrap justify-center gap-2 max-w-md">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSelectExample(q)}
            className="px-3 py-1.5 rounded-full border border-gray-300 bg-white text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
