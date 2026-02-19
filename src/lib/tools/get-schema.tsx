import { useState } from "react";
import { z } from "zod";
import { defineTool } from "glove-react";
import { getSchema } from "../commands";
import type { TableSchema } from "../commands";
import { ErrorDisplay } from "../../components/ErrorDisplay";
import { SAGE, CREAM, FONTS } from "../theme";
import { ChevronDown, ChevronRight, Key } from "lucide-react";
import { parseRenderData } from "./render-data";

const MAX_TABLES_FOR_MODEL = 120;
const MAX_COLUMNS_PER_TABLE_FOR_MODEL = 40;

function buildSchemaContext(schema: TableSchema[], connectionId: string) {
  const tablesForModel = schema.slice(0, MAX_TABLES_FOR_MODEL).map((table) => {
    const columnsForModel = table.columns.slice(0, MAX_COLUMNS_PER_TABLE_FOR_MODEL).map((col) => ({
      name: col.name,
      type: col.data_type,
      nullable: col.nullable,
      primaryKey: col.primary_key,
    }));

    return {
      name: table.name,
      rowCount: table.row_count,
      columnCount: table.columns.length,
      columns: columnsForModel,
      columnsTruncated: table.columns.length > columnsForModel.length,
    };
  });

  return {
    status: "ok" as const,
    connectionId,
    tableCount: schema.length,
    tablesProvided: tablesForModel.length,
    tablesTruncated: schema.length > tablesForModel.length,
    tables: tablesForModel,
  };
}

function SchemaTable({ table }: { table: TableSchema }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          transition: "background 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = CREAM[100])}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {expanded ? (
            <ChevronDown size={12} color={SAGE[400]} />
          ) : (
            <ChevronRight size={12} color={SAGE[400]} />
          )}
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 13,
              fontWeight: 600,
              color: SAGE[800],
            }}
          >
            {table.name}
          </span>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: SAGE[400],
            }}
          >
            {table.columns.length} cols
          </span>
        </div>
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 11,
            color: SAGE[400],
          }}
        >
          {table.row_count.toLocaleString()} rows
        </span>
      </div>

      {expanded && (
        <div
          style={{
            padding: "0 16px 12px 36px",
            opacity: 1,
            transform: "translateY(0)",
            transition: "all 0.2s ease",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    fontFamily: FONTS.body,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: SAGE[400],
                    padding: "4px 8px 4px 0",
                  }}
                >
                  Column
                </th>
                <th
                  style={{
                    textAlign: "left",
                    fontFamily: FONTS.body,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: SAGE[400],
                    padding: "4px 8px",
                  }}
                >
                  Type
                </th>
                <th
                  style={{
                    textAlign: "center",
                    fontFamily: FONTS.body,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: SAGE[400],
                    padding: "4px 8px",
                  }}
                >
                  Nullable
                </th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col) => (
                <tr key={col.name}>
                  <td
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 12,
                      color: SAGE[700],
                      padding: "3px 8px 3px 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {col.primary_key && (
                      <Key
                        size={10}
                        color={SAGE[500]}
                        style={{ flexShrink: 0 }}
                      />
                    )}
                    {col.name}
                  </td>
                  <td
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 11,
                      color: SAGE[500],
                      padding: "3px 8px",
                    }}
                  >
                    {col.data_type}
                  </td>
                  <td
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 11,
                      color: col.nullable ? SAGE[400] : SAGE[300],
                      padding: "3px 8px",
                      textAlign: "center",
                    }}
                  >
                    {col.nullable ? "yes" : "no"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const inputSchema = z.object({
  connectionId: z
    .string()
    .default("conn-1")
    .describe("Database connection ID"),
});

const columnSchema = z.object({
  name: z.string(),
  data_type: z.string(),
  nullable: z.boolean(),
  primary_key: z.boolean(),
});

const tableSchema = z.object({
  name: z.string(),
  columns: z.array(columnSchema),
  row_count: z.number(),
});

const displayPropsSchema = z.object({
  schema: z.array(tableSchema),
  error: z.string().nullable(),
});

export const getSchemaTool = defineTool({
  name: "get_schema",
  description:
    "Retrieve the database schema including tables, columns, and row counts.",
  inputSchema,
  displayPropsSchema,
  resolveSchema: z.void(),
  async do(input, display) {
    try {
      const schema = await getSchema(input.connectionId);
      await display.pushAndForget({ schema, error: null });
      return {
        status: "success",
        data: buildSchemaContext(schema, input.connectionId),
        renderData: { schema, error: null },
      };
    } catch (e) {
      const errorMsg = typeof e === "string" ? e : (e as Error).message || "Failed to load schema";
      await display.pushAndForget({ schema: [], error: errorMsg });
      return {
        status: "error",
        data: { connectionId: input.connectionId, error: errorMsg },
        message: errorMsg,
        renderData: { schema: [], error: errorMsg },
      };
    }
  },
  render({ props }) {
    const { schema, error } = props;

    if (error) {
      return (
        <ErrorDisplay
          title="Schema Error"
          message={error}
          style={{ marginTop: 8 }}
        />
      );
    }

    if (schema.length === 0) {
      return (
        <div
          style={{
            marginTop: 8,
            padding: 24,
            textAlign: "center",
            background: CREAM[50],
            border: `1px solid ${SAGE[100]}`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              color: SAGE[400],
            }}
          >
            No tables found in this database.
          </span>
        </div>
      );
    }

    return (
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            border: `1px solid ${SAGE[100]}`,
            background: CREAM[50],
            overflow: "hidden",
          }}
        >
          {schema.map((table, idx) => (
            <div
              key={table.name}
              style={{
                borderBottom:
                  idx < schema.length - 1
                    ? `1px solid ${SAGE[50]}`
                    : "none",
              }}
            >
              <SchemaTable table={table} />
            </div>
          ))}
        </div>
      </div>
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(displayPropsSchema, data);
    if (!parsed) return null;
    const { schema, error } = parsed;

    if (error) {
      return (
        <ErrorDisplay
          title="Schema Error"
          message={error}
          style={{ marginTop: 8 }}
        />
      );
    }

    if (schema.length === 0) {
      return (
        <div
          style={{
            marginTop: 8,
            padding: 24,
            textAlign: "center",
            background: CREAM[50],
            border: `1px solid ${SAGE[100]}`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              color: SAGE[400],
            }}
          >
            No tables found in this database.
          </span>
        </div>
      );
    }

    return (
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            border: `1px solid ${SAGE[100]}`,
            background: CREAM[50],
            overflow: "hidden",
          }}
        >
          {schema.map((table, idx) => (
            <div
              key={table.name}
              style={{
                borderBottom:
                  idx < schema.length - 1
                    ? `1px solid ${SAGE[50]}`
                    : "none",
              }}
            >
              <SchemaTable table={table as TableSchema} />
            </div>
          ))}
        </div>
      </div>
    );
  },
});
