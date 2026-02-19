import { z } from "zod";
import { defineTool } from "glove-react";
import { DataTable } from "../../components/DataTable";
import { ErrorDisplay } from "../../components/ErrorDisplay";
import { executeQuery, listSavedQueries } from "../commands";
import {
  compileSavedQuerySql,
  extractSavedQueryParams,
  findSavedQueryByReference,
  type SavedQueryParams,
} from "../saved-query-utils";
import { CREAM, FONTS, SAGE } from "../theme";
import { parseRenderData } from "./render-data";

const MAX_ROWS_FOR_MODEL = 50;

function toObjectRows(columns: string[], rows: unknown[][]): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      out[columns[i]] = row[i] ?? null;
    }
    return out;
  });
}

const inputSchema = z.object({
  queryRef: z
    .string()
    .describe("Saved query reference: id, name, or slash alias (without leading slash)"),
  params: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .default({})
    .describe("Parameter values for placeholders like :name, {{name}}, $name, $1, or ?"),
  connectionId: z
    .string()
    .optional()
    .describe("Optional connection override. Defaults to the saved query connection"),
});

const resultSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.unknown())),
  row_count: z.number(),
  execution_time_ms: z.number(),
});

const displayPropsSchema = z.object({
  status: z.enum(["ok", "missing_params", "error"]),
  queryName: z.string().optional(),
  connectionId: z.string().optional(),
  sql: z.string().optional(),
  requiredParams: z.array(z.string()).optional(),
  missingParams: z.array(z.string()).optional(),
  providedParams: z.record(z.string(), z.unknown()).optional(),
  result: resultSchema.optional(),
  error: z.string().optional(),
});

export const executeSavedQueryTool = defineTool({
  name: "execute_saved_query",
  description:
    "Run a saved query by id/name/slash alias with explicit params. Use this for query library references and slash commands.",
  inputSchema,
  displayPropsSchema,
  resolveSchema: z.void(),
  async do(input, display) {
    const allSavedQueries = await listSavedQueries();
    const savedQuery = findSavedQueryByReference(allSavedQueries, input.queryRef);

    if (!savedQuery) {
      const message = `Saved query "${input.queryRef}" not found`;
      await display.pushAndForget({ status: "error", error: message, queryName: input.queryRef });
      return {
        status: "error",
        data: { queryRef: input.queryRef, error: message },
        message,
        renderData: { status: "error", error: message, queryName: input.queryRef },
      };
    }

    const requiredParams = extractSavedQueryParams(savedQuery.sql);
    const compiled = compileSavedQuerySql(savedQuery.sql, input.params as SavedQueryParams);
    if (compiled.missing.length > 0) {
      await display.pushAndForget({
        status: "missing_params",
        queryName: savedQuery.name,
        requiredParams,
        missingParams: compiled.missing,
        providedParams: input.params,
      });
      return {
        status: "error",
        data: {
          queryId: savedQuery.id,
          queryName: savedQuery.name,
          requiredParams,
          missingParams: compiled.missing,
        },
        message: `Missing parameters: ${compiled.missing.join(", ")}`,
        renderData: {
          status: "missing_params",
          queryName: savedQuery.name,
          requiredParams,
          missingParams: compiled.missing,
          providedParams: input.params,
        },
      };
    }

    const connectionId = (input.connectionId || savedQuery.connection_id).trim();

    try {
      const result = await executeQuery(connectionId, compiled.sql);
      await display.pushAndForget({
        status: "ok",
        queryName: savedQuery.name,
        connectionId,
        sql: compiled.sql,
        result,
      });

      const rowsForModel = result.rows.slice(0, MAX_ROWS_FOR_MODEL) as unknown[][];
      return {
        status: "success",
        data: {
          queryId: savedQuery.id,
          queryName: savedQuery.name,
          connectionId,
          sql: compiled.sql,
          rowCount: result.row_count,
          executionTimeMs: result.execution_time_ms,
          columns: result.columns,
          rows: toObjectRows(result.columns, rowsForModel),
          rowsProvided: rowsForModel.length,
          rowsTruncated: result.rows.length > rowsForModel.length,
        },
        renderData: {
          status: "ok",
          queryName: savedQuery.name,
          connectionId,
          sql: compiled.sql,
          result,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await display.pushAndForget({
        status: "error",
        queryName: savedQuery.name,
        connectionId,
        sql: compiled.sql,
        error: message,
      });
      return {
        status: "error",
        data: {
          queryId: savedQuery.id,
          queryName: savedQuery.name,
          connectionId,
          sql: compiled.sql,
          error: message,
        },
        message,
        renderData: {
          status: "error",
          queryName: savedQuery.name,
          connectionId,
          sql: compiled.sql,
          error: message,
        },
      };
    }
  },
  render({ props }) {
    const payload = props;

    if (payload.status === "error") {
      return (
        <ErrorDisplay
          title={`Saved Query Failed${payload.queryName ? `: ${payload.queryName}` : ""}`}
          message={payload.error || "Execution failed"}
          detail={payload.sql}
          style={{ marginTop: 8 }}
        />
      );
    }

    if (payload.status === "missing_params") {
      return (
        <div
          style={{
            marginTop: 8,
            border: `1px solid ${SAGE[100]}`,
            background: CREAM[50],
            padding: 12,
          }}
        >
          <div style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[900], fontWeight: 600 }}>
            Missing parameters for "{payload.queryName}"
          </div>
          <div style={{ fontFamily: FONTS.body, fontSize: 12, color: SAGE[600], marginTop: 6 }}>
            Missing: {(payload.missingParams || []).join(", ")}
          </div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[500], marginTop: 6 }}>
            Required: {(payload.requiredParams || []).join(", ") || "(none)"}
          </div>
        </div>
      );
    }

    const result = payload.result;
    if (!result) return null;

    return (
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: SAGE[800] }}>
            Saved Query: {payload.queryName}
          </span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[500] }}>
            {payload.connectionId}
          </span>
        </div>
        <div
          style={{
            background: SAGE[950],
            padding: "10px 14px",
            marginBottom: 8,
            fontFamily: FONTS.mono,
            fontSize: 12,
            color: "#e0e0e0",
            whiteSpace: "pre-wrap",
            overflowX: "auto",
          }}
        >
          {payload.sql}
        </div>
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
      </div>
    );
  },
  renderResult({ data }) {
    const payload = parseRenderData(displayPropsSchema, data);
    if (!payload) return null;

    if (payload.status === "error") {
      return (
        <ErrorDisplay
          title={`Saved Query Failed${payload.queryName ? `: ${payload.queryName}` : ""}`}
          message={payload.error || "Execution failed"}
          detail={payload.sql}
          style={{ marginTop: 8 }}
        />
      );
    }

    if (payload.status === "missing_params") {
      return (
        <div
          style={{
            marginTop: 8,
            border: `1px solid ${SAGE[100]}`,
            background: CREAM[50],
            padding: 12,
          }}
        >
          <div style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[900], fontWeight: 600 }}>
            Missing parameters for "{payload.queryName}"
          </div>
          <div style={{ fontFamily: FONTS.body, fontSize: 12, color: SAGE[600], marginTop: 6 }}>
            Missing: {(payload.missingParams || []).join(", ")}
          </div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[500], marginTop: 6 }}>
            Required: {(payload.requiredParams || []).join(", ") || "(none)"}
          </div>
        </div>
      );
    }

    const result = payload.result;
    if (!result) return null;

    return (
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: SAGE[800] }}>
            Saved Query: {payload.queryName}
          </span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[500] }}>
            {payload.connectionId}
          </span>
        </div>
        <div
          style={{
            background: SAGE[950],
            padding: "10px 14px",
            marginBottom: 8,
            fontFamily: FONTS.mono,
            fontSize: 12,
            color: "#e0e0e0",
            whiteSpace: "pre-wrap",
            overflowX: "auto",
          }}
        >
          {payload.sql}
        </div>
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
      </div>
    );
  },
});
