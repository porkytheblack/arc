import { useState } from "react";
import { z } from "zod";
import { defineTool } from "glove-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ErrorDisplay } from "../../components/ErrorDisplay";
import { SAGE, CREAM, FONTS } from "../theme";
import { parseRenderData } from "./render-data";
import { saveSavedChart } from "../commands";

const CHART_COLORS = [
  SAGE[500],
  SAGE[700],
  SAGE[300],
  SAGE[900],
  "#4ade80",
  "#d4a853",
  "#c45c5c",
  SAGE[400],
];

function SaveChartButton({
  chartType,
  title,
  description,
  data,
  xKey,
  yKey,
  connectionId,
  sql,
}: {
  chartType: "bar" | "line" | "area" | "pie";
  title: string;
  description?: string;
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  connectionId?: string;
  sql?: string;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const handleSave = async () => {
    if (status === "saving") return;
    setStatus("saving");
    try {
      await saveSavedChart({
        name: title,
        description: description || "Saved from conversation chart output",
        chartType,
        xKey,
        yKey,
        connectionId: connectionId || null,
        sql: sql || null,
        data,
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("arc:saved-charts-updated"));
      }
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        onClick={handleSave}
        disabled={status === "saving"}
        style={{
          border: `1px solid ${SAGE[200]}`,
          background: CREAM[50],
          color: status === "error" ? "#b94a48" : SAGE[700],
          fontFamily: FONTS.mono,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          padding: "5px 9px",
          cursor: status === "saving" ? "default" : "pointer",
          opacity: status === "saving" ? 0.7 : 1,
        }}
      >
        {status === "saving" ? "Saving..." : "Save Chart"}
      </button>
      {status === "saved" && (
        <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[500] }}>
          Saved
        </span>
      )}
      {status === "error" && (
        <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: "#b94a48" }}>
          Failed to save
        </span>
      )}
    </div>
  );
}

const inputSchema = z.object({
  chartType: z
    .enum(["bar", "line", "area", "pie"])
    .default("bar")
    .describe("The type of chart to render"),
  title: z.string().describe("Title for the chart"),
  description: z.string().optional().describe("Optional chart description"),
  data: z
    .array(z.record(z.string(), z.unknown()))
    .describe("Array of data objects for the chart"),
  xKey: z.string().describe("Key for the x-axis (or name key for pie)"),
  yKey: z.string().describe("Key for the y-axis (or value key for pie)"),
  connectionId: z.string().optional().describe("Optional connection id used for this chart"),
  sql: z.string().optional().describe("Optional SQL used to build this chart"),
});

const displayPropsSchema = inputSchema.extend({
  error: z.string().nullable(),
});

export const showChartTool = defineTool({
  name: "show_chart",
  description:
    "Render a chart (bar, line, area, or pie) from structured data.",
  inputSchema,
  displayPropsSchema,
  resolveSchema: z.void(),
  async do(input, display) {
    try {
      if (!input.data || input.data.length === 0) {
        await display.pushAndForget({ ...input, error: "No data provided for chart." });
        return {
          status: "error",
          data: { title: input.title, error: "No data provided for chart." },
          message: "No data provided for chart.",
          renderData: { ...input, error: "No data provided for chart." },
        };
      }
      await display.pushAndForget({
        chartType: input.chartType,
        title: input.title,
        description: input.description,
        data: input.data,
        xKey: input.xKey,
        yKey: input.yKey,
        connectionId: input.connectionId,
        sql: input.sql,
        error: null,
      });
      return {
        status: "success",
        data: {
          title: input.title,
          chartType: input.chartType,
          points: input.data.length,
          xKey: input.xKey,
          yKey: input.yKey,
        },
        renderData: {
          chartType: input.chartType,
          title: input.title,
          description: input.description,
          data: input.data,
          xKey: input.xKey,
          yKey: input.yKey,
          connectionId: input.connectionId,
          sql: input.sql,
          error: null,
        },
      };
    } catch (e) {
      const errorMsg = typeof e === "string" ? e : (e as Error).message || "Chart rendering failed";
      await display.pushAndForget({ ...input, error: errorMsg });
      return {
        status: "error",
        data: { title: input.title, error: errorMsg },
        message: errorMsg,
        renderData: { ...input, error: errorMsg },
      };
    }
  },
  render({ props }) {
    const {
      chartType,
      title,
      description,
      data: chartData,
      xKey,
      yKey,
      connectionId,
      sql,
      error,
    } = props;

    if (error) {
      return <ErrorDisplay title="Chart Error" message={error} style={{ marginTop: 8 }} />;
    }

    if (!chartData || chartData.length === 0) {
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
          <span style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[400] }}>
            No data to display in chart.
          </span>
        </div>
      );
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
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              fontWeight: 600,
              color: SAGE[800],
              display: "block",
            }}
          >
            {title}
          </span>
          <SaveChartButton
            chartType={chartType}
            title={title}
            description={description}
            data={chartData as Record<string, unknown>[]}
            xKey={xKey}
            yKey={yKey}
            connectionId={connectionId}
            sql={sql}
          />
        </div>
        <ResponsiveContainer width="100%" height={280}>
          {chartType === "pie" ? (
            <PieChart>
              <Pie
                data={chartData}
                dataKey={yKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }: { name: string; percent: number }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
                style={{ fontFamily: FONTS.mono, fontSize: 11 }}
              >
                {chartData.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  background: CREAM[50],
                  border: `1px solid ${SAGE[200]}`,
                }}
              />
              <Legend
                wrapperStyle={{
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                }}
              />
            </PieChart>
          ) : chartType === "line" ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={SAGE[100]} />
              <XAxis
                dataKey={xKey}
                tick={{ fontFamily: FONTS.mono, fontSize: 11, fill: SAGE[500] }}
                stroke={SAGE[200]}
              />
              <YAxis
                tick={{ fontFamily: FONTS.mono, fontSize: 11, fill: SAGE[500] }}
                stroke={SAGE[200]}
              />
              <Tooltip
                contentStyle={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  background: CREAM[50],
                  border: `1px solid ${SAGE[200]}`,
                }}
              />
              <Line
                type="monotone"
                dataKey={yKey}
                stroke={SAGE[600]}
                strokeWidth={2}
                dot={{ fill: SAGE[600], r: 3 }}
              />
            </LineChart>
          ) : chartType === "area" ? (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={SAGE[100]} />
              <XAxis
                dataKey={xKey}
                tick={{ fontFamily: FONTS.mono, fontSize: 11, fill: SAGE[500] }}
                stroke={SAGE[200]}
              />
              <YAxis
                tick={{ fontFamily: FONTS.mono, fontSize: 11, fill: SAGE[500] }}
                stroke={SAGE[200]}
              />
              <Tooltip
                contentStyle={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  background: CREAM[50],
                  border: `1px solid ${SAGE[200]}`,
                }}
              />
              <Area type="monotone" dataKey={yKey} stroke={SAGE[600]} fill={SAGE[100]} strokeWidth={2} />
            </AreaChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={SAGE[100]} />
              <XAxis
                dataKey={xKey}
                tick={{ fontFamily: FONTS.mono, fontSize: 11, fill: SAGE[500] }}
                stroke={SAGE[200]}
              />
              <YAxis
                tick={{ fontFamily: FONTS.mono, fontSize: 11, fill: SAGE[500] }}
                stroke={SAGE[200]}
              />
              <Tooltip
                contentStyle={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  background: CREAM[50],
                  border: `1px solid ${SAGE[200]}`,
                }}
              />
              <Bar dataKey={yKey} fill={SAGE[500]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(displayPropsSchema, data);
    if (!parsed) return null;

    const {
      chartType,
      title,
      description,
      data: chartData,
      xKey,
      yKey,
      connectionId,
      sql,
      error,
    } = parsed;

    if (error) {
      return <ErrorDisplay title="Chart Error" message={error} style={{ marginTop: 8 }} />;
    }

    if (!chartData || chartData.length === 0) {
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
          <span style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[400] }}>
            No data to display in chart.
          </span>
        </div>
      );
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
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              fontWeight: 600,
              color: SAGE[800],
              display: "block",
            }}
          >
            {title}
          </span>
          <SaveChartButton
            chartType={chartType}
            title={title}
            description={description}
            data={chartData as Record<string, unknown>[]}
            xKey={xKey}
            yKey={yKey}
            connectionId={connectionId}
            sql={sql}
          />
        </div>
        <ResponsiveContainer width="100%" height={280}>
          {chartType === "pie" ? (
            <PieChart>
              <Pie
                data={chartData}
                dataKey={yKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }: { name: string; percent: number }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
                style={{ fontFamily: FONTS.mono, fontSize: 11 }}
              >
                {chartData.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  background: CREAM[50],
                  border: `1px solid ${SAGE[200]}`,
                }}
              />
              <Legend
                wrapperStyle={{
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                }}
              />
            </PieChart>
          ) : chartType === "line" ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={SAGE[100]} />
              <XAxis
                dataKey={xKey}
                tick={{ fontFamily: FONTS.mono, fontSize: 11, fill: SAGE[500] }}
                stroke={SAGE[200]}
              />
              <YAxis
                tick={{ fontFamily: FONTS.mono, fontSize: 11, fill: SAGE[500] }}
                stroke={SAGE[200]}
              />
              <Tooltip
                contentStyle={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  background: CREAM[50],
                  border: `1px solid ${SAGE[200]}`,
                }}
              />
              <Line
                type="monotone"
                dataKey={yKey}
                stroke={SAGE[600]}
                strokeWidth={2}
                dot={{ fill: SAGE[600], r: 3 }}
              />
            </LineChart>
          ) : chartType === "area" ? (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={SAGE[100]} />
              <XAxis
                dataKey={xKey}
                tick={{ fontFamily: FONTS.mono, fontSize: 11, fill: SAGE[500] }}
                stroke={SAGE[200]}
              />
              <YAxis
                tick={{ fontFamily: FONTS.mono, fontSize: 11, fill: SAGE[500] }}
                stroke={SAGE[200]}
              />
              <Tooltip
                contentStyle={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  background: CREAM[50],
                  border: `1px solid ${SAGE[200]}`,
                }}
              />
              <Area type="monotone" dataKey={yKey} stroke={SAGE[600]} fill={SAGE[100]} strokeWidth={2} />
            </AreaChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={SAGE[100]} />
              <XAxis
                dataKey={xKey}
                tick={{ fontFamily: FONTS.mono, fontSize: 11, fill: SAGE[500] }}
                stroke={SAGE[200]}
              />
              <YAxis
                tick={{ fontFamily: FONTS.mono, fontSize: 11, fill: SAGE[500] }}
                stroke={SAGE[200]}
              />
              <Tooltip
                contentStyle={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  background: CREAM[50],
                  border: `1px solid ${SAGE[200]}`,
                }}
              />
              <Bar dataKey={yKey} fill={SAGE[500]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  },
});
