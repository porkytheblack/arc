import type { ZodType } from "zod";

export function parseRenderData<T>(schema: ZodType<T>, data: unknown): T | null {
  const parsed = schema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
