import { z } from "zod";
import { defineTool } from "glove-react";
import { SAGE, CREAM, FONTS } from "../theme";
import { parseRenderData } from "./render-data";

const inputSchema = z.object({
  sql: z.string().describe("The SQL query that was executed"),
  columns: z.array(z.string()).describe("Column names"),
  values: z.array(z.unknown()).describe("Result values"),
  execution_time_ms: z.number().describe("Query execution time in ms"),
});

export const compactResultTool = defineTool({
  name: "show_compact_result",
  description:
    "Display a compact result for single-value queries like COUNT, MAX, AVG.",
  inputSchema,
  displayPropsSchema: inputSchema,
  resolveSchema: z.void(),
  async do(input, display) {
    await display.pushAndForget(input);
    const summary = input.columns
      .map((col: string, i: number) => `${col}: ${input.values[i]}`)
      .join(", ");
    return {
      status: "success",
      data: `Result: ${summary} (${input.execution_time_ms}ms)`,
      renderData: input,
    };
  },
  render({ props }) {
    const { sql, columns, values, execution_time_ms } = props;
    const typedValues = values as (string | number | boolean | null)[];
    const isSingleValue = columns.length === 1;

    return (
      <div
        style={{
          background: CREAM[50],
          border: `1px solid ${SAGE[100]}`,
          padding: "12px 16px",
          marginTop: 8,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 11,
            color: SAGE[500],
            marginBottom: 8,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {sql}
        </div>
        {isSingleValue ? (
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              fontWeight: 500,
              color: SAGE[900],
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatValue(typedValues[0])}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 24 }}>
            {columns.map((col, i) => (
              <div key={col}>
                <div
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: SAGE[400],
                    marginBottom: 2,
                  }}
                >
                  {col}
                </div>
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 18,
                    fontWeight: 500,
                    color: SAGE[900],
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatValue(typedValues[i])}
                </div>
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 10,
            color: SAGE[300],
            marginTop: 6,
          }}
        >
          {execution_time_ms}ms
        </div>
      </div>
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(inputSchema, data);
    if (!parsed) return null;

    const { sql, columns, values, execution_time_ms } = parsed;
    const typedValues = values as (string | number | boolean | null)[];
    const isSingleValue = columns.length === 1;

    return (
      <div
        style={{
          background: CREAM[50],
          border: `1px solid ${SAGE[100]}`,
          padding: "12px 16px",
          marginTop: 8,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 11,
            color: SAGE[500],
            marginBottom: 8,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {sql}
        </div>
        {isSingleValue ? (
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              fontWeight: 500,
              color: SAGE[900],
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatValue(typedValues[0])}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 24 }}>
            {columns.map((col, i) => (
              <div key={col}>
                <div
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: SAGE[400],
                    marginBottom: 2,
                  }}
                >
                  {col}
                </div>
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 18,
                    fontWeight: 500,
                    color: SAGE[900],
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatValue(typedValues[i])}
                </div>
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 10,
            color: SAGE[300],
            marginTop: 6,
          }}
        >
          {execution_time_ms}ms
        </div>
      </div>
    );
  },
});

function formatValue(v: string | number | boolean | null): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}
