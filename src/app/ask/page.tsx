"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { AskApiResponse } from "@/lib/ask/types";
import EmptyState from "@/components/ask/EmptyState";
import MessageInput from "@/components/ask/MessageInput";
import UserMessage from "@/components/ask/UserMessage";
import AssistantMessage from "@/components/ask/AssistantMessage";
import LoadingMessage from "@/components/ask/LoadingMessage";

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

  // Auto-scroll to bottom when new messages arrive (only if near bottom)
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

  // Build history for API (last 10 turns, text only)
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

    // Create abort controller for this request
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

      // Add error as an assistant message
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
    // Cancel any in-flight request
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

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold text-gray-900">Ask</h1>
        {hasMessages && (
          <button
            onClick={handleNewConversation}
            className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          >
            + New conversation
          </button>
        )}
      </div>

      {/* Message feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto">
        {!hasMessages && !pending ? (
          <EmptyState onSelectExample={handleFollowup} />
        ) : (
          <div className="max-w-4xl mx-auto divide-y divide-gray-100">
            {messages.map((msg) =>
              msg.role === "user" ? (
                <UserMessage key={msg.id} content={msg.content} />
              ) : (
                <AssistantMessage
                  key={msg.id}
                  response={msg.response}
                  onFollowup={handleFollowup}
                />
              )
            )}
            {pending && <LoadingMessage />}
          </div>
        )}
      </div>

      {/* Input */}
      <MessageInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        disabled={pending}
      />
    </div>
  );
}
