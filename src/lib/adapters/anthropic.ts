import type {
  Message,
  ContentPart,
  ToolCall,
} from "glove-core/core";
import { formatToolResultContent, type SerializedTool } from "./shared";

// ─── Anthropic wire types ────────────────────────────────────────────────────

interface AnthropicTextBlock { type: "text"; text: string }
interface AnthropicToolUseBlock { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
interface AnthropicToolResultBlock { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }
interface AnthropicImageBlock { type: "image"; source: { type: "url"; url: string } | { type: "base64"; media_type: string; data: string } }
interface AnthropicDocumentBlock { type: "document"; source: { type: "url"; url: string } | { type: "base64"; media_type: string; data: string } }

type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock | AnthropicImageBlock | AnthropicDocumentBlock;
type AnthropicMessage = { role: "user" | "assistant"; content: string | AnthropicContentBlock[] };
interface AnthropicTool { name: string; description: string; input_schema: Record<string, unknown> }

// ─── Response content block (from API response) ─────────────────────────────

interface AnthropicResponseBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

// ─── Format conversion: Glove → Anthropic ────────────────────────────────────

function formatTools(tools: SerializedTool[]): AnthropicTool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

function formatContentParts(parts: ContentPart[]): AnthropicContentBlock[] {
  const blocks: AnthropicContentBlock[] = [];
  for (const part of parts) {
    switch (part.type) {
      case "text":
        if (part.text) blocks.push({ type: "text", text: part.text });
        break;
      case "image":
        if (part.source) {
          blocks.push({
            type: "image",
            source: part.source.type === "url"
              ? { type: "url" as const, url: part.source.url! }
              : { type: "base64" as const, media_type: part.source.media_type, data: part.source.data! },
          });
        }
        break;
      case "document":
        if (part.source) {
          blocks.push({
            type: "document",
            source: part.source.type === "url"
              ? { type: "url" as const, url: part.source.url! }
              : { type: "base64" as const, media_type: part.source.media_type, data: part.source.data! },
          });
        }
        break;
      case "video":
        blocks.push({ type: "text", text: `[Video attachment: ${part.source?.media_type ?? "video"}]` });
        break;
    }
  }
  return blocks;
}

function formatMessage(msg: Message): AnthropicMessage {
  const role: "user" | "assistant" = msg.sender === "agent" ? "assistant" : "user";

  // tool results flowing back to the model
  if (role === "user" && msg.tool_results?.length) {
    return {
      role: "user",
      content: msg.tool_results.map((tr) => ({
        type: "tool_result" as const,
        tool_use_id: tr.call_id ?? "_unknown",
        content: formatToolResultContent(tr),
        is_error: tr.result.status === "error",
      })),
    };
  }

  // assistant message that made tool calls
  if (role === "assistant" && msg.tool_calls?.length) {
    const content: AnthropicContentBlock[] = [];
    if (msg.text?.length) {
      content.push({ type: "text", text: msg.text });
    }
    for (const tc of msg.tool_calls) {
      content.push({
        type: "tool_use",
        id: tc.id ?? `toolu_${crypto.randomUUID()}`,
        name: tc.tool_name,
        input: (tc.input_args ?? {}) as Record<string, unknown>,
      });
    }
    return { role: "assistant", content };
  }

  // multimodal content
  if (msg.content?.length) {
    return { role, content: formatContentParts(msg.content) };
  }

  // plain text
  return { role, content: msg.text };
}

export function formatAnthropicMessages(messages: Message[]): AnthropicMessage[] {
  // convert & merge consecutive same-role messages
  const merged: AnthropicMessage[] = [];

  for (const msg of messages) {
    const formatted = formatMessage(msg);
    const prev = merged[merged.length - 1];

    if (prev && prev.role === formatted.role) {
      const prevContent = Array.isArray(prev.content)
        ? prev.content
        : [{ type: "text" as const, text: prev.content as string }];
      const newContent = Array.isArray(formatted.content)
        ? formatted.content
        : [{ type: "text" as const, text: formatted.content as string }];
      prev.content = [...prevContent, ...newContent];
    } else {
      merged.push(formatted);
    }
  }

  // deduplicate tool_result blocks by tool_use_id
  for (const msg of merged) {
    if (msg.role !== "user" || !Array.isArray(msg.content)) continue;
    const seen = new Set<string>();
    msg.content = (msg.content as AnthropicContentBlock[]).filter((block) => {
      if (block.type !== "tool_result") return true;
      const tr = block as AnthropicToolResultBlock;
      if (seen.has(tr.tool_use_id)) return false;
      seen.add(tr.tool_use_id);
      return true;
    });
  }

  // ensure every tool_use has a matching tool_result
  for (let i = 0; i < merged.length; i++) {
    const msg = merged[i];
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;

    const toolUseIds = (msg.content as AnthropicContentBlock[])
      .filter((b) => b.type === "tool_use")
      .map((b) => (b as AnthropicToolUseBlock).id);

    if (toolUseIds.length === 0) continue;

    const next = merged[i + 1];
    if (!next || next.role !== "user") {
      merged.splice(i + 1, 0, {
        role: "user",
        content: toolUseIds.map((id) => ({
          type: "tool_result" as const,
          tool_use_id: id,
          content: "No result available",
        })),
      });
      continue;
    }

    const nextContent = Array.isArray(next.content) ? (next.content as AnthropicContentBlock[]) : [];
    const existingIds = new Set(
      nextContent.filter((b) => b.type === "tool_result").map((b) => (b as AnthropicToolResultBlock).tool_use_id),
    );

    const missing = toolUseIds.filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
      const patches = missing.map((id) => ({
        type: "tool_result" as const,
        tool_use_id: id,
        content: "No result available",
      }));
      if (Array.isArray(next.content)) {
        next.content = [...nextContent, ...patches];
      } else {
        next.content = [{ type: "text" as const, text: next.content as string }, ...patches];
      }
    }
  }

  return merged;
}

// ─── Parse Anthropic response → Glove Message ────────────────────────────────

function parseResponse(content: AnthropicResponseBlock[]): Message {
  const textParts: string[] = [];
  const toolCalls: ToolCall[] = [];

  for (const block of content) {
    if (block.type === "text" && block.text) {
      textParts.push(block.text);
    } else if (block.type === "tool_use") {
      toolCalls.push({
        tool_name: block.name!,
        input_args: block.input!,
        id: block.id!,
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

export interface AnthropicPromptConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  systemPrompt: string;
}

export async function promptAnthropicSync(
  config: AnthropicPromptConfig,
  messages: Message[],
  tools?: SerializedTool[],
  signal?: AbortSignal,
): Promise<{ message: Message; tokens_in: number; tokens_out: number }> {
  const body: Record<string, unknown> = {
    model: config.model,
    system: config.systemPrompt,
    messages: formatAnthropicMessages(messages),
    max_tokens: config.maxTokens,
  };

  if (tools?.length) {
    body.tools = formatTools(tools);
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const message = parseResponse(data.content as AnthropicResponseBlock[]);

  return {
    message,
    tokens_in: data.usage?.input_tokens ?? 0,
    tokens_out: data.usage?.output_tokens ?? 0,
  };
}

export async function* promptAnthropicStream(
  config: AnthropicPromptConfig,
  messages: Message[],
  tools?: SerializedTool[],
  signal?: AbortSignal,
): AsyncGenerator<
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "done"; message: Message; tokens_in: number; tokens_out: number }
> {
  const body: Record<string, unknown> = {
    model: config.model,
    system: config.systemPrompt,
    messages: formatAnthropicMessages(messages),
    max_tokens: config.maxTokens,
    stream: true,
  };

  if (tools?.length) {
    body.tools = formatTools(tools);
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  const toolCalls: ToolCall[] = [];
  let currentToolId = "";
  let currentToolName = "";
  let currentToolInput = "";
  let tokensIn = 0;
  let tokensOut = 0;

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

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }

      const eventType = event.type as string;

      if (eventType === "content_block_start") {
        const block = event.content_block as Record<string, unknown>;
        if (block?.type === "tool_use") {
          currentToolId = block.id as string;
          currentToolName = block.name as string;
          currentToolInput = "";
        }
      } else if (eventType === "content_block_delta") {
        const delta = event.delta as Record<string, unknown>;
        if (delta?.type === "text_delta") {
          const text = delta.text as string;
          fullText += text;
          yield { type: "text_delta", text };
        } else if (delta?.type === "input_json_delta") {
          currentToolInput += delta.partial_json as string;
        }
      } else if (eventType === "content_block_stop") {
        if (currentToolName) {
          let input: unknown;
          try {
            input = JSON.parse(currentToolInput);
          } catch {
            input = currentToolInput;
          }
          toolCalls.push({
            tool_name: currentToolName,
            input_args: input,
            id: currentToolId,
          });
          yield { type: "tool_use", id: currentToolId, name: currentToolName, input };
          currentToolId = "";
          currentToolName = "";
          currentToolInput = "";
        }
      } else if (eventType === "message_delta") {
        const usage = (event as Record<string, unknown>).usage as Record<string, number> | undefined;
        if (usage) {
          tokensOut = usage.output_tokens ?? tokensOut;
        }
      } else if (eventType === "message_start") {
        const msg = event.message as Record<string, unknown> | undefined;
        const usage = msg?.usage as Record<string, number> | undefined;
        if (usage) {
          tokensIn = usage.input_tokens ?? 0;
        }
      }
    }
  }

  const message: Message = {
    sender: "agent",
    text: fullText,
    ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
  };

  yield { type: "done", message, tokens_in: tokensIn, tokens_out: tokensOut };
}
