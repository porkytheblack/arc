import type { Tool } from "glove-core/core";
import { z } from "zod";
import type { SerializedTool } from "./shared";

/**
 * Converts Glove tools (with Zod schemas) to serialized JSON schema format,
 * mirroring how glove-react's createRemoteModel strips tools for transport.
 */
export function serializeTools(tools: Tool<unknown>[]): SerializedTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: z.toJSONSchema(tool.input_schema) as Record<string, unknown>,
  }));
}
