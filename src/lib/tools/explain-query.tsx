import { z } from "zod";
import { defineTool } from "glove-react";
import { explainQuery } from "../commands";
import { ErrorDisplay } from "../../components/ErrorDisplay";
import { SAGE, CREAM, FONTS } from "../theme";
import { parseRenderData } from "./render-data";

const inputSchema = z.object({
  connectionId: z
    .string()
    .default("conn-1")
    .describe("Database connection ID"),
  query: z.string().describe("The SQL query to explain"),
});

const queryResultSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.unknown())),
  row_count: z.number(),
  execution_time_ms: z.number(),
});

const displayPropsSchema = z.object({
  query: z.string(),
  result: queryResultSchema.nullable(),
  error: z.string().nullable(),
});

export const explainQueryTool = defineTool({
  name: "explain_query",
  description:
    "Show the execution plan for a SQL query using EXPLAIN.",
  inputSchema,
  displayPropsSchema,
  resolveSchema: z.void(),
  async do(input, display) {
    try {
      const result = await explainQuery(input.connectionId, input.query);
      await display.pushAndForget({ query: input.query, result, error: null });
      return {
        status: "success",
        data: `Execution plan retrieved for query. ${result.row_count} plan rows returned.`,
        renderData: { query: input.query, result, error: null },
      };
    } catch (e) {
      const errorMsg = typeof e === "string" ? e : (e as Error).message || "Failed to explain query";
      await display.pushAndForget({ query: input.query, result: null, error: errorMsg });
      return {
        status: "error",
        data: { query: input.query, error: errorMsg },
        message: errorMsg,
        renderData: { query: input.query, result: null, error: errorMsg },
      };
    }
  },
  render({ props }) {
    const { query, result, error } = props;

    return (
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            background: SAGE[950],
            padding: "12px 16px",
            marginBottom: 8,
            fontFamily: FONTS.mono,
            fontSize: 12,
            color: "#e0e0e0",
            whiteSpace: "pre-wrap",
            overflowX: "auto",
          }}
        >
          EXPLAIN {query}
        </div>
        {error ? (
          <ErrorDisplay title="Explain Error" message={error} detail={query} />
        ) : result ? (
          <div
            style={{
              background: CREAM[50],
              border: `1px solid ${SAGE[100]}`,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "8px 16px",
                background: SAGE[50],
                fontFamily: FONTS.body,
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: SAGE[500],
              }}
            >
              Execution Plan
            </div>
            <div
              style={{
                padding: "12px 16px",
                fontFamily: FONTS.mono,
                fontSize: 12,
                lineHeight: 1.6,
                color: SAGE[700],
                whiteSpace: "pre-wrap",
                overflowX: "auto",
              }}
            >
              {result.rows.map((row, ri) => (
                <div key={ri}>
                  {row.map((cell) => (cell === null ? "NULL" : String(cell))).join(" | ")}
                </div>
              ))}
            </div>
            <div
              style={{
                padding: "6px 16px",
                borderTop: `1px solid ${SAGE[50]}`,
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: SAGE[400],
              }}
            >
              {result.execution_time_ms}ms
            </div>
          </div>
        ) : null}
      </div>
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(displayPropsSchema, data);
    if (!parsed) return null;
    const { query, result, error } = parsed;

    return (
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            background: SAGE[950],
            padding: "12px 16px",
            marginBottom: 8,
            fontFamily: FONTS.mono,
            fontSize: 12,
            color: "#e0e0e0",
            whiteSpace: "pre-wrap",
            overflowX: "auto",
          }}
        >
          EXPLAIN {query}
        </div>
        {error ? (
          <ErrorDisplay title="Explain Error" message={error} detail={query} />
        ) : result ? (
          <div
            style={{
              background: CREAM[50],
              border: `1px solid ${SAGE[100]}`,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "8px 16px",
                background: SAGE[50],
                fontFamily: FONTS.body,
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: SAGE[500],
              }}
            >
              Execution Plan
            </div>
            <div
              style={{
                padding: "12px 16px",
                fontFamily: FONTS.mono,
                fontSize: 12,
                lineHeight: 1.6,
                color: SAGE[700],
                whiteSpace: "pre-wrap",
                overflowX: "auto",
              }}
            >
              {result.rows.map((row, ri) => (
                <div key={ri}>
                  {row.map((cell) => (cell === null ? "NULL" : String(cell))).join(" | ")}
                </div>
              ))}
            </div>
            <div
              style={{
                padding: "6px 16px",
                borderTop: `1px solid ${SAGE[50]}`,
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: SAGE[400],
              }}
            >
              {result.execution_time_ms}ms
            </div>
          </div>
        ) : null}
      </div>
    );
  },
});
