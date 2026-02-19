import type {
  Message,
  ModelAdapter,
  ModelPromptResult,
  NotifySubscribersFunction,
  PromptRequest,
} from "glove-core/core";
import type { SerializedTool } from "./shared";
import {
  promptAnthropicSync,
  promptAnthropicStream,
  type AnthropicPromptConfig,
} from "./anthropic";
import {
  promptOpenAISync,
  promptOpenAIStream,
  type OpenAICompatPromptConfig,
} from "./openai-compat";
import { serializeTools } from "./serialize-tools";

// ─── Provider config ─────────────────────────────────────────────────────────

export interface ProviderDef {
  id: string;
  name: string;
  baseURL: string;
  envVar: string;
  defaultModel: string;
  models: string[];
  format: "anthropic" | "openai";
  defaultMaxTokens: number;
}

export const providers: Record<string, ProviderDef> = {
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    envVar: "OPENROUTER_API_KEY",
    defaultModel: "anthropic/claude-sonnet-4",
    models: [
      "anthropic/claude-sonnet-4",
      "anthropic/claude-opus-4",
      "openai/gpt-4.1",
      "openai/gpt-4.1-mini",
      "google/gemini-2.5-flash",
      "google/gemini-2.5-pro",
      "minimax/minimax-m2.5",
      "moonshotai/kimi-k2.5",
      "z-ai/glm-5",
    ],
    format: "openai",
    defaultMaxTokens: 8192,
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    baseURL: "https://api.anthropic.com",
    envVar: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-20250514",
    models: [
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250514",
      "claude-haiku-3-5-20241022",
    ],
    format: "anthropic",
    defaultMaxTokens: 8192,
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    envVar: "OPENAI_API_KEY",
    defaultModel: "gpt-4.1",
    models: [
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "gpt-4o",
      "o4-mini",
    ],
    format: "openai",
    defaultMaxTokens: 4096,
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    envVar: "GEMINI_API_KEY",
    defaultModel: "gemini-2.5-flash",
    models: [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
    ],
    format: "openai",
    defaultMaxTokens: 8192,
  },
  minimax: {
    id: "minimax",
    name: "MiniMax",
    baseURL: "https://api.minimax.io/v1",
    envVar: "MINIMAX_API_KEY",
    defaultModel: "MiniMax-M2.5",
    models: [
      "MiniMax-M2.5",
      "MiniMax-M2.5-highspeed",
      "MiniMax-M2.1",
    ],
    format: "openai",
    defaultMaxTokens: 8192,
  },
  kimi: {
    id: "kimi",
    name: "Kimi (Moonshot)",
    baseURL: "https://api.moonshot.ai/v1",
    envVar: "MOONSHOT_API_KEY",
    defaultModel: "kimi-k2.5",
    models: [
      "kimi-k2.5",
      "kimi-k2-0905-preview",
      "moonshot-v1-auto",
    ],
    format: "openai",
    defaultMaxTokens: 8192,
  },
  glm: {
    id: "glm",
    name: "GLM (Zhipu AI)",
    baseURL: "https://open.bigmodel.cn/api/paas/v4/",
    envVar: "ZHIPUAI_API_KEY",
    defaultModel: "glm-4-plus",
    models: [
      "glm-4-plus",
      "glm-4-long",
      "glm-4-flash",
    ],
    format: "openai",
    defaultMaxTokens: 4096,
  },
};

// ─── Browser-safe adapter factory ────────────────────────────────────────────

export interface CreateBrowserAdapterOptions {
  provider: string;
  model?: string;
  apiKey: string;
  maxTokens?: number;
  stream?: boolean;
}

export function createBrowserAdapter(opts: CreateBrowserAdapterOptions): ModelAdapter {
  const providerDef = providers[opts.provider] || providers.openai;
  const model = opts.model || providerDef.defaultModel;
  const maxTokens = opts.maxTokens ?? providerDef.defaultMaxTokens;
  const useStreaming = opts.stream ?? true;

  let systemPrompt = "";

  const adapter: ModelAdapter = {
    name: `${providerDef.id}:${model}`,

    setSystemPrompt(sp: string) {
      systemPrompt = sp;
    },

    async prompt(
      request: PromptRequest,
      notify: NotifySubscribersFunction,
      signal?: AbortSignal,
    ): Promise<ModelPromptResult> {
      const tools: SerializedTool[] | undefined = request.tools?.length
        ? serializeTools(request.tools)
        : undefined;

      if (providerDef.format === "anthropic") {
        return promptAnthropicAdapter(
          { apiKey: opts.apiKey, model, maxTokens, systemPrompt },
          request.messages, tools, notify, useStreaming, signal,
        );
      }

      return promptOpenAIAdapter(
        { baseURL: providerDef.baseURL, apiKey: opts.apiKey, model, maxTokens, systemPrompt },
        request.messages, tools, notify, useStreaming, signal,
      );
    },
  };

  return adapter;
}

// ─── Internal adapter dispatchers ────────────────────────────────────────────

async function promptAnthropicAdapter(
  config: AnthropicPromptConfig,
  messages: Message[],
  tools: SerializedTool[] | undefined,
  notify: NotifySubscribersFunction,
  streaming: boolean,
  signal?: AbortSignal,
): Promise<ModelPromptResult> {
  if (!streaming) {
    const { message, tokens_in, tokens_out } = await promptAnthropicSync(config, messages, tools, signal);
    await notify("model_response", {
      text: message.text,
      tool_calls: message.tool_calls,
    });
    return { messages: [message], tokens_in, tokens_out };
  }

  let result: ModelPromptResult = { messages: [], tokens_in: 0, tokens_out: 0 };

  for await (const event of promptAnthropicStream(config, messages, tools, signal)) {
    if (event.type === "text_delta") {
      await notify("text_delta", { text: event.text });
    } else if (event.type === "tool_use") {
      await notify("tool_use", { id: event.id, name: event.name, input: event.input });
    } else if (event.type === "done") {
      await notify("model_response_complete", {
        text: event.message.text,
        tool_calls: event.message.tool_calls,
      });
      result = { messages: [event.message], tokens_in: event.tokens_in, tokens_out: event.tokens_out };
    }
  }

  return result;
}

async function promptOpenAIAdapter(
  config: OpenAICompatPromptConfig,
  messages: Message[],
  tools: SerializedTool[] | undefined,
  notify: NotifySubscribersFunction,
  streaming: boolean,
  signal?: AbortSignal,
): Promise<ModelPromptResult> {
  if (!streaming) {
    const { message, tokens_in, tokens_out } = await promptOpenAISync(config, messages, tools, signal);
    await notify("model_response", {
      text: message.text,
      tool_calls: message.tool_calls,
    });
    return { messages: [message], tokens_in, tokens_out };
  }

  let result: ModelPromptResult = { messages: [], tokens_in: 0, tokens_out: 0 };

  for await (const event of promptOpenAIStream(config, messages, tools, signal)) {
    if (event.type === "text_delta") {
      await notify("text_delta", { text: event.text });
    } else if (event.type === "tool_use") {
      await notify("tool_use", { id: event.id, name: event.name, input: event.input });
    } else if (event.type === "done") {
      await notify("model_response_complete", {
        text: event.message.text,
        tool_calls: event.message.tool_calls,
      });
      result = { messages: [event.message], tokens_in: event.tokens_in, tokens_out: event.tokens_out };
    }
  }

  return result;
}

export { formatAnthropicMessages } from "./anthropic";
export { formatOpenAIMessages } from "./openai-compat";
