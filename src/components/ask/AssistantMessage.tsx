"use client";

import type { AskApiResponse } from "@/lib/ask/types";
import AnswerTable from "./AnswerTable";
import FollowupSuggestions from "./FollowupSuggestions";
import DetailsPanel from "./DetailsPanel";

interface AssistantMessageProps {
  response: AskApiResponse;
  onFollowup: (question: string) => void;
}

export default function AssistantMessage({
  response,
  onFollowup,
}: AssistantMessageProps) {
  const isError = response.result_type === "error";

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${
          isError ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700"
        }`}
      >
        AI
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        {/* Answer text */}
        <div
          className={`text-sm whitespace-pre-wrap ${
            isError ? "text-red-700" : "text-gray-900"
          }`}
        >
          {response.answer_text}
        </div>

        {/* Table (if any) */}
        {response.table &&
          response.table.columns.length > 0 &&
          response.table.rows.length > 0 && (
            <AnswerTable
              table={response.table}
              question={response.answer_text}
            />
          )}

        {/* Followup suggestions */}
        {response.suggested_followups &&
          response.suggested_followups.length > 0 && (
            <FollowupSuggestions
              suggestions={response.suggested_followups}
              onClick={onFollowup}
            />
          )}

        {/* Details panel (tools used, SQL) */}
        {response.tools_used && response.tools_used.length > 0 && (
          <DetailsPanel
            toolsUsed={response.tools_used}
            sqlUsed={response.sql_used}
          />
        )}
      </div>
    </div>
  );
}
