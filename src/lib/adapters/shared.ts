import type { ToolResult } from "glove-core/core";

/**
 * Extracts tool result content as a string, mirroring upstream formatToolResultContent.
 */
export function formatToolResultContent(tr: ToolResult): string {
  if (tr.result.status === "error") {
    const detail = tr.result.data ? JSON.stringify(tr.result.data) : "";
    return `Error: ${tr.result.message ?? "Unknown error"}\n${detail}`.trim();
  }
  return typeof tr.result.data === "string"
    ? tr.result.data
    : JSON.stringify(tr.result.data);
}

/**
 * JSON.parse with fallback — returns the original string if parsing fails.
 */
export function safeJsonParse(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/** Serialized tool definition (JSON schema, no Zod) */
export interface SerializedTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
