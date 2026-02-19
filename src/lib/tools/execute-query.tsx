import { z } from "zod";
import { defineTool } from "glove-react";
import { executeQuery } from "../commands";
import { DataTable } from "../../components/DataTable";
import { ErrorDisplay } from "../../components/ErrorDisplay";
import { SAGE, FONTS } from "../theme";
import { parseRenderData } from "./render-data";

const MAX_ROWS_FOR_MODEL = 50;

function toObjectRows(columns: string[], rows: unknown[][]): Record<string, unknown>[] {
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      obj[columns[i]] = row[i] ?? null;
    }
    return obj;
  });
}

const inputSchema = z.object({
  sql: z.string().describe("The SQL query to execute"),
  connectionId: z
    .string()
    .default("conn-1")
    .describe("Database connection ID"),
});

const queryResultSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.unknown())),
  row_count: z.number(),
  execution_time_ms: z.number(),
});

const displayPropsSchema = z.object({
  sql: z.string(),
  result: queryResultSchema.nullable(),
  error: z.string().nullable(),
});

export const executeQueryTool = defineTool({
  name: "execute_query",
  description:
    "Execute a SQL query against a database connection and show the results in a table.",
  inputSchema,
  displayPropsSchema,
  resolveSchema: z.void(),
  async do(input, display) {
    try {
      const result = await executeQuery(input.connectionId, input.sql);
      await display.pushAndForget({ sql: input.sql, result, error: null });
      const rowsForModel = result.rows.slice(0, MAX_ROWS_FOR_MODEL) as unknown[][];
      return {
        status: "success",
        data: {
          connectionId: input.connectionId,
          sql: input.sql,
          rowCount: result.row_count,
          executionTimeMs: result.execution_time_ms,
          columns: result.columns,
          rows: toObjectRows(result.columns, rowsForModel),
          rowsProvided: rowsForModel.length,
          rowsTruncated: result.rows.length > rowsForModel.length,
        },
        renderData: { sql: input.sql, result, error: null },
      };
    } catch (e) {
      const errorMsg = typeof e === "string" ? e : (e as Error).message || "Query execution failed";
      await display.pushAndForget({ sql: input.sql, result: null, error: errorMsg });
      return {
        status: "error",
        data: {
          connectionId: input.connectionId,
          sql: input.sql,
          error: errorMsg,
        },
        message: errorMsg,
        renderData: { sql: input.sql, result: null, error: errorMsg },
      };
    }
  },
  render({ props }) {
    const { sql, result, error } = props;
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
          {sql}
        </div>
        {error ? (
          <ErrorDisplay
            title="Query Error"
            message={error}
            detail={sql}
          />
        ) : result ? (
          <>
            <DataTable
              columns={result.columns}
              rows={result.rows as (string | number | boolean | null)[][]}
            />
            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 6,
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: SAGE[400],
              }}
            >
              <span>{result.row_count} rows</span>
              <span>{result.execution_time_ms}ms</span>
            </div>
          </>
        ) : null}
      </div>
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(displayPropsSchema, data);
    if (!parsed) return null;
    const { sql, result, error } = parsed;

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
          {sql}
        </div>
        {error ? (
          <ErrorDisplay
            title="Query Error"
            message={error}
            detail={sql}
          />
        ) : result ? (
          <>
            <DataTable
              columns={result.columns}
              rows={result.rows as (string | number | boolean | null)[][]}
            />
            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 6,
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: SAGE[400],
              }}
            >
              <span>{result.row_count} rows</span>
              <span>{result.execution_time_ms}ms</span>
            </div>
          </>
        ) : null}
      </div>
    );
  },
});
