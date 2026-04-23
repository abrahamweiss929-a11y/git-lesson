"use client";

import type { AskApiResponse } from "@/lib/ask/types";
import AnswerTable from "./AnswerTable";
import FollowupSuggestions from "./FollowupSuggestions";
import DetailsPanel from "./DetailsPanel";
import Icon from "@/components/ui/Icon";

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
    <div className="flex gap-4">
      {isError ? (
        <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white bg-rose-500 shadow-lg shadow-rose-500/20">
          <Icon name="warning" size={16} />
        </div>
      ) : (
        <div
          className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white shadow-lg shadow-amber-500/20"
          style={{
            background: "linear-gradient(135deg, #0D9488 0%, #F59E0B 100%)",
          }}
        >
          <Icon name="sparkle" size={16} />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-4">
        <p
          className={`text-sm whitespace-pre-wrap leading-relaxed ${
            isError ? "text-rose-700" : "text-slate-900"
          }`}
        >
          {response.answer_text}
        </p>

        {response.table &&
          response.table.columns.length > 0 &&
          response.table.rows.length > 0 && (
            <AnswerTable
              table={response.table}
              question={response.answer_text}
            />
          )}

        {response.suggested_followups &&
          response.suggested_followups.length > 0 && (
            <FollowupSuggestions
              suggestions={response.suggested_followups}
              onClick={onFollowup}
            />
          )}

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
