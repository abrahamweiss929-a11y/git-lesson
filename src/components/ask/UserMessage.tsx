"use client";

interface UserMessageProps {
  content: string;
}

export default function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="flex justify-end">
      <div
        className="rounded-2xl rounded-tr-sm px-5 py-3 text-sm max-w-xl shadow-sm text-white whitespace-pre-wrap"
        style={{
          background: "linear-gradient(135deg, #0D9488 0%, #0F766E 100%)",
        }}
      >
        {content}
      </div>
    </div>
  );
}
