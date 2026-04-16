import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  ensureToolsRegistered,
  getToolDefinitions,
  executeTool,
} from "@/lib/ai-tools";
import { buildSystemBlocks } from "@/lib/ask/system-prompt";
import { AskRequestSchema, type AskApiResponse } from "@/lib/ask/types";
import {
  parseStructuredResponse,
  MalformedResponseError,
} from "@/lib/ask/parse-response";
import type { ToolUseRecord } from "@/lib/ai-tools/types";
import { createRateLimiter } from "@/lib/rate-limit";

export const maxDuration = 60;

const MAX_ITERATIONS = 10;
const INTERNAL_TIMEOUT_MS = 50_000; // abort gracefully before Vercel's 60s

// Rate limit: 30 requests/minute per IP (uses shared rate-limit module)
const rateLimiter = createRateLimiter(30);

export async function POST(
  request: NextRequest
): Promise<NextResponse<AskApiResponse | { error: string }>> {
  // Rate limit
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const rateCheck = rateLimiter.check(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds ?? 60) },
      }
    );
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  const parseResult = AskRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.errors[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const { question, history } = parseResult.data;

  try {
    // Ensure all tools are registered
    await ensureToolsRegistered();

    const anthropic = new Anthropic();
    const systemBlocks = buildSystemBlocks();
    const toolDefinitions = getToolDefinitions();

    // Build messages: last 10 history turns + current question
    const historyTruncated = history.slice(-10);
    const messages: Anthropic.MessageParam[] = [
      ...historyTruncated.map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user", content: question },
    ];

    let iterations = 0;
    const toolsUsedTracker: ToolUseRecord[] = [];
    const startTime = Date.now();

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      // Check internal timeout
      if (Date.now() - startTime > INTERNAL_TIMEOUT_MS) {
        return NextResponse.json({
          answer_text:
            "This is taking longer than expected. Try asking a simpler question or breaking it into parts.",
          result_type: "error" as const,
          tools_used: toolsUsedTracker,
          suggested_followups: [],
          error: "Request timed out.",
        });
      }

      // Call Claude with retry for 5xx/429
      let response: Anthropic.Message;
      try {
        response = await callWithRetry(anthropic, {
          model: "claude-sonnet-4-6",
          system: systemBlocks,
          tools: toolDefinitions as Anthropic.Tool[],
          messages,
          max_tokens: 4096,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown API error";
        console.error("[AI Ask] Anthropic API error:", msg);
        return NextResponse.json({
          answer_text:
            "I had trouble connecting to the AI service. Please try again.",
          result_type: "error" as const,
          tools_used: toolsUsedTracker,
          suggested_followups: [],
          error: msg,
        });
      }

      if (response.stop_reason === "end_turn") {
        // Final answer — extract and validate the JSON block
        const fullText = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");

        console.log(
          `[AI Ask] end_turn at iteration ${iterations}. Content blocks: ${response.content.map((b) => b.type).join(", ")}`
        );

        try {
          const result = parseStructuredResponse(fullText, toolsUsedTracker);
          return NextResponse.json(result);
        } catch (e) {
          const errMsg =
            e instanceof Error ? e.message : String(e);
          console.error(
            `[AI Ask] Parse failed (attempt ${iterations}): ${errMsg}`
          );

          if (
            e instanceof MalformedResponseError &&
            iterations < MAX_ITERATIONS
          ) {
            // Retry once with corrective prompt
            console.log("[AI Ask] Sending corrective prompt for retry...");
            messages.push({ role: "assistant", content: response.content });
            messages.push({
              role: "user",
              content:
                'Your response was missing or had a malformed JSON block. Please re-output your answer ending with a ```json``` code block containing a JSON object with these exact fields: {"answer_text": "...", "result_type": "scalar|table|narrative|error", "table": {"columns": [{"key": "...", "label": "...", "type": "string|number|date|currency"}], "rows": [...]}, "suggested_followups": ["...", "..."]}. The table field is optional. Make sure the JSON is valid.',
            });
            continue;
          }
          // Second failure — return graceful error
          return NextResponse.json({
            answer_text:
              "I had trouble formatting my response. Please try asking again.",
            result_type: "error" as const,
            tools_used: toolsUsedTracker,
            suggested_followups: [],
            error: `AI response was malformed: ${errMsg}`,
          });
        }
      }

      if (response.stop_reason === "tool_use") {
        // Execute tools and loop
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
        );

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of toolUseBlocks) {
          const resultStr = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            toolsUsedTracker
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: resultStr,
          });
        }

        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // Unexpected stop reason
      break;
    }

    // Max iterations reached
    return NextResponse.json({
      answer_text:
        "I needed too many steps to answer this. Try a more specific question.",
      result_type: "error" as const,
      tools_used: toolsUsedTracker,
      suggested_followups: [
        "Ask a simpler question",
        "Be more specific",
      ],
      error: "Max iterations reached.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unknown error occurred.";
    console.error("[AI Ask] Unhandled error:", message);
    return NextResponse.json(
      { error: `Internal error: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * Call Anthropic with retry on 5xx/429. Max 2 retries with exponential backoff.
 */
async function callWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParams,
  maxRetries = 2
): Promise<Anthropic.Message> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Only retry on 5xx or 429
      const status =
        (err as { status?: number }).status ?? 0;
      if (status >= 500 || status === 429) {
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }
      throw lastError;
    }
  }
  throw lastError!;
}
