import { z } from "zod";
import { defineTool } from "glove-react";
import { saveQuery } from "../commands";
import { ErrorDisplay } from "../../components/ErrorDisplay";
import { SAGE, CREAM, FONTS, SEMANTIC } from "../theme";
import { CheckCircle } from "lucide-react";
import { parseRenderData } from "./render-data";

const inputSchema = z.object({
  name: z.string().describe("Name for the saved query"),
  description: z
    .string()
    .default("")
    .describe("Description of what the query does"),
  sql: z.string().describe("The SQL query to save"),
  connectionId: z
    .string()
    .default("conn-1")
    .describe("Database connection ID"),
});

const displayPropsSchema = z.object({
  name: z.string(),
  description: z.string(),
  sql: z.string(),
  id: z.string().nullable(),
  error: z.string().nullable(),
});

export const saveQueryTool = defineTool({
  name: "save_query",
  description: "Save a SQL query to the query library for future reference.",
  inputSchema,
  displayPropsSchema,
  resolveSchema: z.void(),
  async do(input, display) {
    try {
      const saved = await saveQuery({
        name: input.name,
        description: input.description,
        sql: input.sql,
        connectionId: input.connectionId,
      });
      await display.pushAndForget({
        name: saved.name,
        description: saved.description,
        sql: saved.sql,
        id: saved.id,
        error: null,
      });
      return {
        status: "success",
        data: `Query "${saved.name}" saved successfully with ID ${saved.id}.`,
        renderData: {
          name: saved.name,
          description: saved.description,
          sql: saved.sql,
          id: saved.id,
          error: null,
        },
      };
    } catch (e) {
      const errorMsg = typeof e === "string" ? e : (e as Error).message || "Failed to save query";
      await display.pushAndForget({
        name: input.name,
        description: input.description,
        sql: input.sql,
        id: null,
        error: errorMsg,
      });
      return {
        status: "error",
        data: {
          name: input.name,
          description: input.description,
          sql: input.sql,
          error: errorMsg,
        },
        message: errorMsg,
        renderData: {
          name: input.name,
          description: input.description,
          sql: input.sql,
          id: null,
          error: errorMsg,
        },
      };
    }
  },
  render({ props }) {
    const { name, description, sql, error } = props;

    if (error) {
      return <ErrorDisplay title="Save Error" message={error} style={{ marginTop: 8 }} />;
    }

    return (
      <div
        style={{
          marginTop: 8,
          background: CREAM[50],
          border: `1px solid ${SAGE[100]}`,
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <CheckCircle size={16} color={SEMANTIC.success} />
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              fontWeight: 600,
              color: SAGE[800],
            }}
          >
            Query saved: {name}
          </span>
        </div>
        {description && (
          <p
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              color: SAGE[600],
              margin: "0 0 8px",
            }}
          >
            {description}
          </p>
        )}
        <div
          style={{
            background: SAGE[950],
            padding: "8px 12px",
            fontFamily: FONTS.mono,
            fontSize: 12,
            color: "#e0e0e0",
            whiteSpace: "pre-wrap",
            overflowX: "auto",
          }}
        >
          {sql}
        </div>
      </div>
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(displayPropsSchema, data);
    if (!parsed) return null;
    const { name, description, sql, error } = parsed;

    if (error) {
      return <ErrorDisplay title="Save Error" message={error} style={{ marginTop: 8 }} />;
    }

    return (
      <div
        style={{
          marginTop: 8,
          background: CREAM[50],
          border: `1px solid ${SAGE[100]}`,
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <CheckCircle size={16} color={SEMANTIC.success} />
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              fontWeight: 600,
              color: SAGE[800],
            }}
          >
            Query saved: {name}
          </span>
        </div>
        {description && (
          <p
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              color: SAGE[600],
              margin: "0 0 8px",
            }}
          >
            {description}
          </p>
        )}
        <div
          style={{
            background: SAGE[950],
            padding: "8px 12px",
            fontFamily: FONTS.mono,
            fontSize: 12,
            color: "#e0e0e0",
            whiteSpace: "pre-wrap",
            overflowX: "auto",
          }}
        >
          {sql}
        </div>
      </div>
    );
  },
});
