"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { AskApiResponse } from "@/lib/ask/types";
import EmptyState from "@/components/ask/EmptyState";
import MessageInput from "@/components/ask/MessageInput";
import UserMessage from "@/components/ask/UserMessage";
import AssistantMessage from "@/components/ask/AssistantMessage";
import LoadingMessage from "@/components/ask/LoadingMessage";
import Icon from "@/components/ui/Icon";

type Message =
  | { role: "user"; content: string; id: string }
  | { role: "assistant"; response: AskApiResponse; id: string };

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const isNearBottom =
      feed.scrollHeight - feed.scrollTop - feed.clientHeight < 150;
    if (isNearBottom) {
      requestAnimationFrame(() => {
        feed.scrollTop = feed.scrollHeight;
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, pending, scrollToBottom]);

  function buildHistory() {
    const historyMessages = messages.slice(-10);
    return historyMessages.map((m) => {
      if (m.role === "user") {
        return { role: "user" as const, content: m.content };
      }
      return {
        role: "assistant" as const,
        content: m.response.answer_text,
      };
    });
  }

  async function handleSubmit() {
    const question = inputValue.trim();
    if (!question || pending) return;

    setInputValue("");
    setError(null);

    const userMsg: Message = {
      role: "user",
      content: question,
      id: crypto.randomUUID(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setPending(true);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const history = buildHistory();

      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errorMsg =
          errorData?.error || `Request failed (${res.status})`;
        throw new Error(errorMsg);
      }

      const data: AskApiResponse = await res.json();

      const assistantMsg: Message = {
        role: "assistant",
        response: data,
        id: crypto.randomUUID(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;

      const errorMsg =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(errorMsg);

      const errorResponse: AskApiResponse = {
        answer_text: errorMsg,
        result_type: "error",
        tools_used: [],
        suggested_followups: ["Try asking again"],
        error: errorMsg,
      };
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          response: errorResponse,
          id: crypto.randomUUID(),
        },
      ]);
    } finally {
      setPending(false);
      abortRef.current = null;
    }
  }

  function handleNewConversation() {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setMessages([]);
    setInputValue("");
    setError(null);
    setPending(false);
  }

  function handleFollowup(question: string) {
    setInputValue(question);
  }

  const hasMessages = messages.length > 0;
  // Suppress unused-var eslint since `error` is surfaced via the assistant message
  void error;

  return (
    <div className="flex flex-col h-[calc(100vh-72px)]">
      {/* New conversation affordance — floats above content when there's history */}
      {hasMessages && (
        <div className="shrink-0 px-8 pt-4 flex justify-end max-w-4xl mx-auto w-full">
          <button
            type="button"
            onClick={handleNewConversation}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-teal-700 hover:bg-teal-50/60 px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            <Icon name="plus" size={14} />
            New conversation
          </button>
        </div>
      )}

      {/* Message feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto">
        {!hasMessages && !pending ? (
          <EmptyState onSelectExample={handleFollowup} />
        ) : (
          <div className="max-w-4xl mx-auto px-8 py-6 space-y-6">
            {messages.map((msg) =>
              msg.role === "user" ? (
                <UserMessage key={msg.id} content={msg.content} />
              ) : (
                <AssistantMessage
                  key={msg.id}
                  response={msg.response}
                  onFollowup={handleFollowup}
                />
              ),
            )}
            {pending && <LoadingMessage />}
          </div>
        )}
      </div>

      <MessageInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        disabled={pending}
      />
    </div>
  );
}
