import { z } from "zod";
import { defineTool } from "glove-react";
import { getDatabaseStats } from "../commands";
import { ErrorDisplay } from "../../components/ErrorDisplay";
import { SAGE, CREAM, FONTS, SEMANTIC } from "../theme";
import { parseRenderData } from "./render-data";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const inputSchema = z.object({
  connectionId: z
    .string()
    .default("conn-1")
    .describe("Database connection ID"),
});

const statsSchema = z.object({
  connection_id: z.string(),
  table_count: z.number(),
  total_row_count: z.number(),
  disk_usage_bytes: z.number(),
  connected: z.boolean(),
});

const displayPropsSchema = z.object({
  stats: statsSchema.nullable(),
  error: z.string().nullable(),
});

export const databaseStatsTool = defineTool({
  name: "get_database_stats",
  description:
    "Retrieve database statistics including table count, total rows, and disk usage.",
  inputSchema,
  displayPropsSchema,
  resolveSchema: z.void(),
  async do(input, display) {
    try {
      const stats = await getDatabaseStats(input.connectionId);
      await display.pushAndForget({ stats, error: null });
      return {
        status: "success",
        data: {
          connectionId: input.connectionId,
          tableCount: stats.table_count,
          totalRows: stats.total_row_count,
          diskUsageBytes: stats.disk_usage_bytes,
          diskUsageHuman: formatBytes(stats.disk_usage_bytes),
          connected: stats.connected,
        },
        renderData: { stats, error: null },
      };
    } catch (e) {
      const errorMsg = typeof e === "string" ? e : (e as Error).message || "Failed to load stats";
      await display.pushAndForget({ stats: null, error: errorMsg });
      return {
        status: "error",
        data: { connectionId: input.connectionId, error: errorMsg },
        message: errorMsg,
        renderData: { stats: null, error: errorMsg },
      };
    }
  },
  render({ props }) {
    const { stats, error } = props;

    if (error) {
      return <ErrorDisplay title="Stats Error" message={error} style={{ marginTop: 8 }} />;
    }

    if (!stats) return null;

    const items: { label: string; value: string; color?: string }[] = [
      { label: "Tables", value: String(stats.table_count) },
      {
        label: "Total Rows",
        value: stats.total_row_count.toLocaleString(),
      },
      {
        label: "Disk Usage",
        value: formatBytes(stats.disk_usage_bytes),
      },
      {
        label: "Status",
        value: stats.connected ? "Connected" : "Disconnected",
        color: stats.connected ? SEMANTIC.success : SAGE[400],
      },
    ];

    return (
      <div
        style={{
          marginTop: 8,
          background: CREAM[50],
          border: `1px solid ${SAGE[100]}`,
          overflow: "hidden",
        }}
      >
        {items.map((item, idx) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 16px",
              borderBottom:
                idx < items.length - 1
                  ? `1px solid ${SAGE[50]}`
                  : "none",
            }}
          >
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 13,
                color: SAGE[600],
              }}
            >
              {item.label}
            </span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 13,
                color: item.color || SAGE[800],
                fontWeight: 500,
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(displayPropsSchema, data);
    if (!parsed) return null;
    const { stats, error } = parsed;

    if (error) {
      return <ErrorDisplay title="Stats Error" message={error} style={{ marginTop: 8 }} />;
    }
    if (!stats) return null;

    const items: { label: string; value: string; color?: string }[] = [
      { label: "Tables", value: String(stats.table_count) },
      {
        label: "Total Rows",
        value: stats.total_row_count.toLocaleString(),
      },
      {
        label: "Disk Usage",
        value: formatBytes(stats.disk_usage_bytes),
      },
      {
        label: "Status",
        value: stats.connected ? "Connected" : "Disconnected",
        color: stats.connected ? SEMANTIC.success : SAGE[400],
      },
    ];

    return (
      <div
        style={{
          marginTop: 8,
          background: CREAM[50],
          border: `1px solid ${SAGE[100]}`,
          overflow: "hidden",
        }}
      >
        {items.map((item, idx) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 16px",
              borderBottom:
                idx < items.length - 1
                  ? `1px solid ${SAGE[50]}`
                  : "none",
            }}
          >
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 13,
                color: SAGE[600],
              }}
            >
              {item.label}
            </span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 13,
                color: item.color || SAGE[800],
                fontWeight: 500,
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    );
  },
});
