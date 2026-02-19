import { z } from "zod";
import { defineTool } from "glove-react";
import { getTableMetadata } from "../commands";
import { ErrorDisplay } from "../../components/ErrorDisplay";
import { SAGE, CREAM, FONTS } from "../theme";
import { Key, ArrowRight } from "lucide-react";
import { parseRenderData } from "./render-data";

const inputSchema = z.object({
  connectionId: z
    .string()
    .default("conn-1")
    .describe("Database connection ID"),
  tableName: z.string().describe("Name of the table to inspect"),
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

const metaSchema = z.object({
  schema: tableSchema,
  indexes: z.array(
    z.object({
      name: z.string(),
      columns: z.array(z.string()),
      unique: z.boolean(),
    })
  ),
  foreign_keys: z.array(
    z.object({
      name: z.string(),
      from_column: z.string(),
      to_table: z.string(),
      to_column: z.string(),
    })
  ),
});

const displayPropsSchema = z.object({
  meta: metaSchema.nullable(),
  error: z.string().nullable(),
});

export const getTableMetadataTool = defineTool({
  name: "get_table_metadata",
  description:
    "Retrieve detailed metadata for a table including indexes and foreign keys.",
  inputSchema,
  displayPropsSchema,
  resolveSchema: z.void(),
  async do(input, display) {
    try {
      const meta = await getTableMetadata(input.connectionId, input.tableName);
      await display.pushAndForget({ meta, error: null });
      return {
        status: "success",
        data: {
          connectionId: input.connectionId,
          tableName: input.tableName,
          table: {
            name: meta.schema.name,
            rowCount: meta.schema.row_count,
            columns: meta.schema.columns.map((c) => ({
              name: c.name,
              type: c.data_type,
              nullable: c.nullable,
              primaryKey: c.primary_key,
            })),
          },
          indexes: meta.indexes.map((idx) => ({
            name: idx.name,
            columns: idx.columns,
            unique: idx.unique,
          })),
          foreignKeys: meta.foreign_keys.map((fk) => ({
            name: fk.name,
            fromColumn: fk.from_column,
            toTable: fk.to_table,
            toColumn: fk.to_column,
          })),
        },
        renderData: { meta, error: null },
      };
    } catch (e) {
      const errorMsg = typeof e === "string" ? e : (e as Error).message || "Failed to load table metadata";
      await display.pushAndForget({ meta: null, error: errorMsg });
      return {
        status: "error",
        data: {
          connectionId: input.connectionId,
          tableName: input.tableName,
          error: errorMsg,
        },
        message: errorMsg,
        renderData: { meta: null, error: errorMsg },
      };
    }
  },
  render({ props }) {
    const { meta, error } = props;

    if (error) {
      return <ErrorDisplay title="Metadata Error" message={error} style={{ marginTop: 8 }} />;
    }

    if (!meta) return null;

    return (
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 13,
            fontWeight: 600,
            color: SAGE[800],
            marginBottom: 8,
          }}
        >
          {meta.schema.name}
          <span style={{ fontWeight: 400, color: SAGE[400], marginLeft: 8, fontSize: 11 }}>
            {meta.schema.row_count.toLocaleString()} rows
          </span>
        </div>

        {meta.indexes.length > 0 && (
          <div
            style={{
              background: CREAM[50],
              border: `1px solid ${SAGE[100]}`,
              marginBottom: 8,
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
              Indexes
            </div>
            {meta.indexes.map((idx, i) => (
              <div
                key={idx.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 16px",
                  borderBottom: i < meta.indexes.length - 1 ? `1px solid ${SAGE[50]}` : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Key size={10} color={idx.unique ? SAGE[600] : SAGE[300]} />
                  <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: SAGE[700] }}>
                    {idx.name}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[500] }}>
                    {idx.columns.join(", ")}
                  </span>
                  {idx.unique && (
                    <span
                      style={{
                        fontFamily: FONTS.mono,
                        fontSize: 9,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: SAGE[500],
                        background: SAGE[50],
                        padding: "2px 6px",
                      }}
                    >
                      unique
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {meta.foreign_keys.length > 0 && (
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
              Foreign Keys
            </div>
            {meta.foreign_keys.map((fk, i) => (
              <div
                key={fk.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderBottom: i < meta.foreign_keys.length - 1 ? `1px solid ${SAGE[50]}` : "none",
                }}
              >
                <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: SAGE[700] }}>
                  {fk.from_column}
                </span>
                <ArrowRight size={12} color={SAGE[400]} />
                <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: SAGE[600] }}>
                  {fk.to_table}
                </span>
                <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[400] }}>
                  ({fk.to_column})
                </span>
              </div>
            ))}
          </div>
        )}

        {meta.indexes.length === 0 && meta.foreign_keys.length === 0 && (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              background: CREAM[50],
              border: `1px solid ${SAGE[100]}`,
              fontFamily: FONTS.body,
              fontSize: 13,
              color: SAGE[400],
            }}
          >
            No indexes or foreign keys found for this table.
          </div>
        )}
      </div>
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(displayPropsSchema, data);
    if (!parsed) return null;
    const { meta, error } = parsed;

    if (error) {
      return <ErrorDisplay title="Metadata Error" message={error} style={{ marginTop: 8 }} />;
    }

    if (!meta) return null;

    return (
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 13,
            fontWeight: 600,
            color: SAGE[800],
            marginBottom: 8,
          }}
        >
          {meta.schema.name}
          <span style={{ fontWeight: 400, color: SAGE[400], marginLeft: 8, fontSize: 11 }}>
            {meta.schema.row_count.toLocaleString()} rows
          </span>
        </div>

        {meta.indexes.length > 0 && (
          <div
            style={{
              background: CREAM[50],
              border: `1px solid ${SAGE[100]}`,
              marginBottom: 8,
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
              Indexes
            </div>
            {meta.indexes.map((idx, i) => (
              <div
                key={idx.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 16px",
                  borderBottom: i < meta.indexes.length - 1 ? `1px solid ${SAGE[50]}` : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Key size={10} color={idx.unique ? SAGE[600] : SAGE[300]} />
                  <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: SAGE[700] }}>
                    {idx.name}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[500] }}>
                    {idx.columns.join(", ")}
                  </span>
                  {idx.unique && (
                    <span
                      style={{
                        fontFamily: FONTS.mono,
                        fontSize: 9,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: SAGE[500],
                        background: SAGE[50],
                        padding: "2px 6px",
                      }}
                    >
                      unique
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {meta.foreign_keys.length > 0 && (
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
              Foreign Keys
            </div>
            {meta.foreign_keys.map((fk, i) => (
              <div
                key={fk.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderBottom: i < meta.foreign_keys.length - 1 ? `1px solid ${SAGE[50]}` : "none",
                }}
              >
                <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: SAGE[700] }}>
                  {fk.from_column}
                </span>
                <ArrowRight size={12} color={SAGE[400]} />
                <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: SAGE[600] }}>
                  {fk.to_table}
                </span>
                <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[400] }}>
                  ({fk.to_column})
                </span>
              </div>
            ))}
          </div>
        )}

        {meta.indexes.length === 0 && meta.foreign_keys.length === 0 && (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              background: CREAM[50],
              border: `1px solid ${SAGE[100]}`,
              fontFamily: FONTS.body,
              fontSize: 13,
              color: SAGE[400],
            }}
          >
            No indexes or foreign keys found for this table.
          </div>
        )}
      </div>
    );
  },
});
