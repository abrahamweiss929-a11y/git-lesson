"use client";

interface UserMessageProps {
  content: string;
}

export default function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 text-sm">
        You
      </div>
      <div className="text-sm text-gray-900 pt-1.5 whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}
