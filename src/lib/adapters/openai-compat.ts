import type {
  Message,
  ContentPart,
  ToolCall,
} from "glove-core/core";
import { formatToolResultContent, safeJsonParse, type SerializedTool } from "./shared";

// ─── OpenAI wire types ──────────────────────────────────────────────────────

interface OpenAIToolCallWire {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

type OpenAIMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | OpenAIContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: OpenAIToolCallWire[] }
  | { role: "tool"; tool_call_id: string; content: string };

type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface OpenAITool {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

// ─── Format conversion: Glove → OpenAI ──────────────────────────────────────

function formatTools(tools: SerializedTool[]): OpenAITool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

function formatContentParts(parts: ContentPart[]): OpenAIContentPart[] {
  const result: OpenAIContentPart[] = [];
  for (const part of parts) {
    switch (part.type) {
      case "text":
        if (part.text) result.push({ type: "text", text: part.text });
        break;
      case "image":
      case "video":
        if (part.source) {
          const url = part.source.type === "url"
            ? part.source.url!
            : `data:${part.source.media_type};base64,${part.source.data}`;
          result.push({ type: "image_url", image_url: { url } });
        }
        break;
      case "document":
        result.push({ type: "text", text: `[Document attachment: ${part.source?.media_type ?? "document"}]` });
        break;
    }
  }
  return result;
}

// A single Glove Message may expand to multiple OpenAI messages because
// tool results are separate { role: "tool" } messages in the OpenAI format.
function formatMessage(msg: Message): OpenAIMessage[] {
  const role: "user" | "assistant" = msg.sender === "agent" ? "assistant" : "user";

  // tool results → individual { role: "tool" } messages
  if (role === "user" && msg.tool_results?.length) {
    return msg.tool_results.map((tr) => ({
      role: "tool" as const,
      tool_call_id: tr.call_id ?? "_unknown",
      content: formatToolResultContent(tr),
    }));
  }

  // assistant message that made tool calls
  if (role === "assistant" && msg.tool_calls?.length) {
    return [{
      role: "assistant" as const,
      content: msg.text || null,
      tool_calls: msg.tool_calls.map((tc) => ({
        id: tc.id ?? `call_${crypto.randomUUID()}`,
        type: "function" as const,
        function: {
          name: tc.tool_name,
          arguments: typeof tc.input_args === "string"
            ? tc.input_args
            : JSON.stringify(tc.input_args ?? {}),
        },
      })),
    }];
  }

  // multimodal content — only user messages support content part arrays
  if (msg.content?.length && role === "user") {
    return [{ role: "user" as const, content: formatContentParts(msg.content) }];
  }

  // plain text
  return [{ role, content: msg.text } as OpenAIMessage];
}

export function formatOpenAIMessages(messages: Message[]): OpenAIMessage[] {
  // Stage 1: flatten — each Glove message may produce multiple OpenAI messages
  const flat: OpenAIMessage[] = [];
  for (const msg of messages) {
    flat.push(...formatMessage(msg));
  }

  // Stage 2: merge consecutive user messages
  const merged: OpenAIMessage[] = [];
  for (const msg of flat) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === "user" && msg.role === "user") {
      const prevText = typeof prev.content === "string" ? prev.content : String(prev.content);
      const newText = typeof msg.content === "string" ? msg.content : String(msg.content);
      (prev as { role: "user"; content: string }).content = prevText + "\n" + newText;
    } else {
      merged.push(msg);
    }
  }

  // Stage 3: deduplicate tool result messages by tool_call_id
  const seenToolCallIds = new Set<string>();
  const deduped: OpenAIMessage[] = [];
  for (const msg of merged) {
    if (msg.role === "tool") {
      if (seenToolCallIds.has(msg.tool_call_id)) continue;
      seenToolCallIds.add(msg.tool_call_id);
    }
    deduped.push(msg);
  }

  // Stage 4: repair orphaned tool_calls — every assistant message with
  // tool_calls must be followed by matching { role: "tool" } messages
  const repaired: OpenAIMessage[] = [];
  for (let i = 0; i < deduped.length; i++) {
    repaired.push(deduped[i]);
    const msg = deduped[i];

    if (msg.role !== "assistant" || !msg.tool_calls?.length) continue;

    const expectedIds = new Set(msg.tool_calls.map((tc) => tc.id));

    // look ahead through immediately-following tool messages
    const foundIds = new Set<string>();
    let j = i + 1;
    while (j < deduped.length && deduped[j].role === "tool") {
      const toolMsg = deduped[j] as Extract<OpenAIMessage, { role: "tool" }>;
      foundIds.add(toolMsg.tool_call_id);
      j++;
    }

    // insert synthetic results for any missing IDs
    for (const id of expectedIds) {
      if (!foundIds.has(id)) {
        repaired.push({
          role: "tool" as const,
          tool_call_id: id,
          content: "No result available",
        });
      }
    }
  }

  return repaired;
}

// ─── Parse OpenAI response → Glove Message ───────────────────────────────────

function parseChoice(choice: Record<string, unknown>): Message {
  const msg = choice.message as Record<string, unknown>;
  const textParts: string[] = [];
  const toolCalls: ToolCall[] = [];

  if (msg.content) {
    textParts.push(msg.content as string);
  }

  const tcs = msg.tool_calls as OpenAIToolCallWire[] | undefined;
  if (tcs?.length) {
    for (const tc of tcs) {
      if (tc.type !== "function") continue;
      toolCalls.push({
        tool_name: tc.function.name,
        input_args: safeJsonParse(tc.function.arguments),
        id: tc.id,
      });
    }
  }

  return {
    sender: "agent",
    text: textParts.join(""),
    ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
  };
}

// ─── Fetch-based prompt functions ────────────────────────────────────────────

export interface OpenAICompatPromptConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  systemPrompt: string;
}

export async function promptOpenAISync(
  config: OpenAICompatPromptConfig,
  messages: Message[],
  tools?: SerializedTool[],
  signal?: AbortSignal,
): Promise<{ message: Message; tokens_in: number; tokens_out: number }> {
  const openaiMessages: OpenAIMessage[] = [
    { role: "system", content: config.systemPrompt },
    ...formatOpenAIMessages(messages),
  ];

  const body: Record<string, unknown> = {
    model: config.model,
    messages: openaiMessages,
    max_tokens: config.maxTokens,
  };

  if (tools?.length) {
    body.tools = formatTools(tools);
  }

  const res = await fetch(`${config.baseURL.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${config.model} error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const choice = data.choices[0];
  if (!choice) {
    return { message: { sender: "agent", text: "" }, tokens_in: 0, tokens_out: 0 };
  }

  return {
    message: parseChoice(choice),
    tokens_in: data.usage?.prompt_tokens ?? 0,
    tokens_out: data.usage?.completion_tokens ?? 0,
  };
}

export async function* promptOpenAIStream(
  config: OpenAICompatPromptConfig,
  messages: Message[],
  tools?: SerializedTool[],
  signal?: AbortSignal,
): AsyncGenerator<
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "done"; message: Message; tokens_in: number; tokens_out: number }
> {
  const openaiMessages: OpenAIMessage[] = [
    { role: "system", content: config.systemPrompt },
    ...formatOpenAIMessages(messages),
  ];

  const body: Record<string, unknown> = {
    model: config.model,
    messages: openaiMessages,
    max_tokens: config.maxTokens,
    stream: true,
    stream_options: { include_usage: true },
  };

  if (tools?.length) {
    body.tools = formatTools(tools);
  }

  const res = await fetch(`${config.baseURL.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${config.model} error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  const toolCallAccumulator = new Map<number, { id: string; name: string; arguments: string }>();
  let tokensIn = 0;
  let tokensOut = 0;
  let finishReason: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;

      let chunk: Record<string, unknown>;
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }

      // Usage arrives in the final chunk
      const usage = chunk.usage as Record<string, number> | undefined;
      if (usage) {
        tokensIn = usage.prompt_tokens ?? 0;
        tokensOut = usage.completion_tokens ?? 0;
      }

      const choices = chunk.choices as Record<string, unknown>[] | undefined;
      const choice = choices?.[0];
      if (!choice) continue;

      if (choice.finish_reason) {
        finishReason = choice.finish_reason as string;
      }

      const delta = choice.delta as Record<string, unknown> | undefined;
      if (!delta) continue;

      // text content delta
      if (delta.content) {
        const text = delta.content as string;
        fullText += text;
        yield { type: "text_delta", text };
      }

      // tool call deltas — arrive incrementally
      const tcDeltas = delta.tool_calls as Record<string, unknown>[] | undefined;
      if (tcDeltas) {
        for (const tcDelta of tcDeltas) {
          const idx = tcDelta.index as number;
          if (!toolCallAccumulator.has(idx)) {
            toolCallAccumulator.set(idx, {
              id: (tcDelta.id as string) ?? `call_${crypto.randomUUID()}`,
              name: (tcDelta.function as Record<string, string>)?.name ?? "",
              arguments: "",
            });
          }
          const acc = toolCallAccumulator.get(idx)!;
          if (tcDelta.id) acc.id = tcDelta.id as string;
          const fn = tcDelta.function as Record<string, string> | undefined;
          if (fn?.name) acc.name = fn.name;
          if (fn?.arguments) acc.arguments += fn.arguments;
        }
      }
    }
  }

  // assemble completed tool calls from accumulated deltas
  const toolCalls: ToolCall[] = [];
  for (const [, acc] of toolCallAccumulator) {
    const parsedArgs = safeJsonParse(acc.arguments);
    toolCalls.push({
      tool_name: acc.name,
      input_args: parsedArgs,
      id: acc.id,
    });
    yield { type: "tool_use", id: acc.id, name: acc.name, input: parsedArgs };
  }

  const message: Message = {
    sender: "agent",
    text: fullText,
    ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
  };

  void finishReason; // consumed by caller if needed
  yield { type: "done", message, tokens_in: tokensIn, tokens_out: tokensOut };
}
