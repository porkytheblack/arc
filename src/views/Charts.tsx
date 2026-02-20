import { useState, useEffect, useCallback, useMemo } from "react";
import { z } from "zod";
import { SAGE, CREAM, FONTS, mixins } from "../lib/theme";
import { Card } from "../components/Card";
import { Tag } from "../components/Tag";
import { Button } from "../components/Button";
import { Select } from "../components/Select";
import {
  listConnections,
  getSchema,
  executeQuery,
  listSavedCharts,
  listConnectionNotes,
  listSavedQueries,
  saveSavedChart,
  deleteSavedChart,
  getSetting,
} from "../lib/commands";
import type {
  DatabaseConnection,
  TableSchema,
  ColumnInfo,
  QueryResult,
  SavedChart,
  ConnectionNote,
  SavedQuery,
} from "../lib/commands";
import { createBrowserAdapter, providers } from "../lib/adapters";

import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { ReactNode } from "react";
import {
  BarChart3,
  TrendingUp,
  Activity,
  PieChart as PieChartIcon,
  Play,
  Loader2,
  Database,
  AlertTriangle,
  Sparkles,
  Trash2,
  RefreshCw,
  Save,
  Beaker,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChartType = "bar" | "line" | "area" | "pie";

type BuilderMode = "ai" | "manual";

interface ChartDataPoint {
  x: string;
  y: number;
}

interface ChartCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  tags?: string[];
}

interface ChartPlan {
  title: string;
  description: string;
  chartType: ChartType;
  sql: string;
  xKey: string;
  yKey: string;
}

interface ChartPreview {
  title: string;
  description: string;
  chartType: ChartType;
  connectionId: string;
  sql: string;
  xKey: string;
  yKey: string;
  dataRows: Record<string, unknown>[];
  points: ChartDataPoint[];
  executionTimeMs: number | null;
  source: "ai" | "manual" | "saved";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PIE_COLORS = [SAGE[900], SAGE[700], SAGE[500], SAGE[300], SAGE[200]];

const customTooltipStyle: React.CSSProperties = {
  background: SAGE[900],
  border: "none",
  padding: "8px 12px",
  fontFamily: FONTS.mono,
  fontSize: 12,
  color: CREAM[50],
};

const CHART_TYPE_OPTIONS: {
  type: ChartType;
  label: string;
  Icon: typeof BarChart3;
}[] = [
  { type: "bar", label: "Bar", Icon: BarChart3 },
  { type: "line", label: "Line", Icon: TrendingUp },
  { type: "area", label: "Area", Icon: Activity },
  { type: "pie", label: "Pie", Icon: PieChartIcon },
];

const NUMERIC_TYPES = [
  "integer",
  "int",
  "int2",
  "int4",
  "int8",
  "bigint",
  "smallint",
  "serial",
  "bigserial",
  "real",
  "float",
  "float4",
  "float8",
  "double",
  "double precision",
  "numeric",
  "decimal",
  "number",
];

const AI_PLAN_SCHEMA = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  chartType: z.enum(["bar", "line", "area", "pie"]),
  sql: z.string().min(1),
  xKey: z.string().min(1),
  yKey: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNumericColumn(col: ColumnInfo): boolean {
  const lower = col.data_type.toLowerCase();
  return NUMERIC_TYPES.some((t) => lower.includes(t));
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function isReadOnlySql(sql: string): boolean {
  const normalized = sql.trim().toLowerCase();
  return normalized.startsWith("select") || normalized.startsWith("with") || normalized.startsWith("explain");
}

function isNumericValue(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return false;
    return Number.isFinite(Number(trimmed));
  }
  return false;
}

function toObjectRows(result: QueryResult): Record<string, unknown>[] {
  return result.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < result.columns.length; i++) {
      obj[result.columns[i]] = row[i] ?? null;
    }
    return obj;
  });
}

function toChartData(rows: Record<string, unknown>[], xKey: string, yKey: string): ChartDataPoint[] {
  return rows
    .map((row) => {
      const xValue = row[xKey];
      const yValue = row[yKey];
      const y = typeof yValue === "number" ? yValue : Number(String(yValue ?? ""));
      if (!Number.isFinite(y)) return null;
      return {
        x: xValue == null ? "(null)" : String(xValue),
        y,
      };
    })
    .filter((p): p is ChartDataPoint => p !== null);
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(candidate.slice(first, last + 1));
    }
    throw new Error("Could not parse JSON from model response.");
  }
}

function inferChartTypeFromPrompt(prompt: string): ChartType {
  const lower = prompt.toLowerCase();
  if (lower.includes("pie") || lower.includes("share") || lower.includes("distribution")) return "pie";
  if (lower.includes("area")) return "area";
  if (lower.includes("line") || lower.includes("trend") || lower.includes("over time") || lower.includes("timeline")) return "line";
  return "bar";
}

function chooseTableFromPrompt(prompt: string, tables: TableSchema[]): TableSchema | null {
  const lower = prompt.toLowerCase();
  const exact = tables.find((t) => lower.includes(t.name.toLowerCase()));
  if (exact) return exact;
  return tables[0] ?? null;
}

function buildHeuristicPlan(prompt: string, tables: TableSchema[]): ChartPlan {
  const table = chooseTableFromPrompt(prompt, tables);
  if (!table) {
    throw new Error("No schema available to infer a chart.");
  }

  const lower = prompt.toLowerCase();
  const chartType = inferChartTypeFromPrompt(prompt);
  const numericCols = table.columns.filter(isNumericColumn);
  const dimensionCols = table.columns.filter((c) => !isNumericColumn(c));
  const dateLike = table.columns.find((c) => {
    const dt = c.data_type.toLowerCase();
    return dt.includes("date") || dt.includes("time") || dt.includes("timestamp");
  });

  const xCol = dateLike?.name || dimensionCols[0]?.name || table.columns[0]?.name;
  const metricCol = numericCols[0]?.name || table.columns[1]?.name || table.columns[0]?.name;

  if (!xCol || !metricCol) {
    throw new Error(`Could not infer columns for table ${table.name}.`);
  }

  if (lower.includes("count") || lower.includes("how many") || lower.includes("number of")) {
    return {
      title: `Count by ${xCol}`,
      description: `Grouped count from ${table.name}`,
      chartType,
      sql: `SELECT ${quoteIdentifier(xCol)} AS x, COUNT(*) AS y FROM ${quoteIdentifier(table.name)} GROUP BY 1 ORDER BY 2 DESC LIMIT 100`,
      xKey: "x",
      yKey: "y",
    };
  }

  const aggMap: Array<{ keyword: string; fn: "SUM" | "AVG" | "MIN" | "MAX" }> = [
    { keyword: "sum", fn: "SUM" },
    { keyword: "average", fn: "AVG" },
    { keyword: "avg", fn: "AVG" },
    { keyword: "minimum", fn: "MIN" },
    { keyword: "min", fn: "MIN" },
    { keyword: "maximum", fn: "MAX" },
    { keyword: "max", fn: "MAX" },
  ];

  const agg = aggMap.find((item) => lower.includes(item.keyword));
  if (agg) {
    return {
      title: `${agg.fn}(${metricCol}) by ${xCol}`,
      description: `Aggregated from ${table.name}`,
      chartType,
      sql: `SELECT ${quoteIdentifier(xCol)} AS x, ${agg.fn}(${quoteIdentifier(metricCol)}) AS y FROM ${quoteIdentifier(table.name)} GROUP BY 1 ORDER BY 2 DESC LIMIT 100`,
      xKey: "x",
      yKey: "y",
    };
  }

  return {
    title: `${table.name}: ${xCol} vs ${metricCol}`,
    description: "Direct sample from table",
    chartType,
    sql: `SELECT ${quoteIdentifier(xCol)} AS x, ${quoteIdentifier(metricCol)} AS y FROM ${quoteIdentifier(table.name)} LIMIT 150`,
    xKey: "x",
    yKey: "y",
  };
}

async function buildModelPlan(
  prompt: string,
  tables: TableSchema[],
  chartTypeHint: ChartType | "auto",
  context: {
    connectionId: string;
    connectionNotes: ConnectionNote[];
    savedQueries: SavedQuery[];
  },
): Promise<ChartPlan> {
  const [provider, apiKey, aiModel] = await Promise.all([
    getSetting("ai_provider"),
    getSetting("ai_api_key"),
    getSetting("ai_model"),
  ]);

  const prov = provider || "openrouter";
  const key = apiKey?.trim() || "";
  if (!key) {
    throw new Error("No AI API key configured. Using heuristic planner instead.");
  }

  const providerDef = providers[prov] || providers.openrouter;
  const adapter = createBrowserAdapter({
    provider: prov,
    apiKey: key,
    model: aiModel || providerDef.defaultModel,
    stream: false,
  });

  adapter.setSystemPrompt(
    "You are a chart planning assistant for SQL databases. Return only strict JSON with keys: title, description, chartType, sql, xKey, yKey. SQL must be SELECT/WITH only and should alias plotted columns to xKey/yKey when needed."
  );

  const tableContext = tables
    .slice(0, 60)
    .map((t) => {
      const cols = t.columns
        .slice(0, 30)
        .map((c) => `${c.name} (${c.data_type})`)
        .join(", ");
      return `- ${t.name}: ${cols}`;
    })
    .join("\n");

  const notesContext = context.connectionNotes
    .slice(0, 20)
    .map((note) => `- ${note.note}`)
    .join("\n");

  const savedQueriesContext = context.savedQueries
    .slice(0, 30)
    .map((q) => {
      const sqlSnippet = q.sql.replace(/\s+/g, " ").trim().slice(0, 260);
      return `- ${q.name}${q.description ? `: ${q.description}` : ""} | SQL: ${sqlSnippet}`;
    })
    .join("\n");

  const userPrompt = [
    `User request: ${prompt}`,
    `Connection: ${context.connectionId}`,
    `Preferred chart type: ${chartTypeHint === "auto" ? "auto" : chartTypeHint}`,
    "Connection notes:",
    notesContext || "(none)",
    "Saved queries for this connection:",
    savedQueriesContext || "(none)",
    "Available schema:",
    tableContext || "(none)",
    "Return JSON only.",
  ].join("\n");

  let responseText = "";
  const result = await adapter.prompt(
    {
      messages: [{ sender: "user", text: userPrompt }],
      tools: [],
    },
    async (eventName, eventData) => {
      if (eventName === "model_response") {
        const payload = eventData as { text?: string };
        responseText = payload.text || "";
      }
    },
  );

  if (!responseText) {
    responseText = result.messages[0]?.text || "";
  }

  const parsed = AI_PLAN_SCHEMA.parse(extractJsonObject(responseText));
  if (!isReadOnlySql(parsed.sql)) {
    throw new Error("Model returned non-read-only SQL.");
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// StyledSelect
// ---------------------------------------------------------------------------

function StyledSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      minWidth={150}
      style={{
        width: "auto",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// ChartCard
// ---------------------------------------------------------------------------

function ChartCard({ title, description, children, tags }: ChartCardProps) {
  return (
    <Card style={{ padding: 0 }}>
      <div style={{ padding: "20px 24px 0" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h3
              style={{
                fontFamily: FONTS.body,
                fontSize: 14,
                fontWeight: 600,
                color: SAGE[900],
                margin: 0,
              }}
            >
              {title}
            </h3>
            {description && (
              <p
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 12,
                  color: SAGE[500],
                  margin: "4px 0 0",
                }}
              >
                {description}
              </p>
            )}
          </div>
          {tags && (
            <div style={{ display: "flex", gap: 4 }}>
              {tags.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: "16px 16px 20px" }}>{children}</div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ChartRenderer
// ---------------------------------------------------------------------------

function ChartRenderer({
  data,
  chartType,
  xLabel,
  yLabel,
}: {
  data: ChartDataPoint[];
  chartType: ChartType;
  xLabel: string;
  yLabel: string;
}) {
  const axisTickStyle = { fontFamily: FONTS.mono, fontSize: 10, fill: SAGE[400] };
  const axisLabelStyle = { fontFamily: FONTS.body, fontSize: 11, fill: SAGE[500] };

  if (chartType === "pie") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <ResponsiveContainer width="55%" height={260}>
          <PieChart>
            <Pie data={data} dataKey="y" nameKey="x" cx="50%" cy="50%" outerRadius={100} strokeWidth={0}>
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={customTooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1, maxHeight: 260, overflowY: "auto" }}>
          {data.map((point, i) => (
            <div key={`${point.x}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
              <div style={{ width: 10, height: 10, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
              <span style={{ fontFamily: FONTS.body, fontSize: 12, color: SAGE[700], flex: 1 }}>{point.x}</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[500] }}>{point.y.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (chartType === "area") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={SAGE[100]} />
          <XAxis
            dataKey="x"
            tick={axisTickStyle}
            axisLine={{ stroke: SAGE[100] }}
            tickLine={false}
            label={{ value: xLabel, position: "insideBottom", offset: -5, style: axisLabelStyle }}
          />
          <YAxis
            tick={axisTickStyle}
            axisLine={false}
            tickLine={false}
            label={{ value: yLabel, angle: -90, position: "insideLeft", style: axisLabelStyle }}
          />
          <Tooltip contentStyle={customTooltipStyle} />
          <Area type="monotone" dataKey="y" stroke={SAGE[700]} fill={SAGE[100]} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={SAGE[100]} />
          <XAxis
            dataKey="x"
            tick={axisTickStyle}
            axisLine={{ stroke: SAGE[100] }}
            tickLine={false}
            label={{ value: xLabel, position: "insideBottom", offset: -5, style: axisLabelStyle }}
          />
          <YAxis
            tick={axisTickStyle}
            axisLine={false}
            tickLine={false}
            label={{ value: yLabel, angle: -90, position: "insideLeft", style: axisLabelStyle }}
          />
          <Tooltip contentStyle={customTooltipStyle} />
          <Line type="monotone" dataKey="y" stroke={SAGE[700]} strokeWidth={2} dot={{ fill: SAGE[700], r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={SAGE[100]} />
        <XAxis
          dataKey="x"
          tick={axisTickStyle}
          axisLine={{ stroke: SAGE[100] }}
          tickLine={false}
          label={{ value: xLabel, position: "insideBottom", offset: -5, style: axisLabelStyle }}
        />
        <YAxis
          tick={axisTickStyle}
          axisLine={false}
          tickLine={false}
          label={{ value: yLabel, angle: -90, position: "insideLeft", style: axisLabelStyle }}
        />
        <Tooltip contentStyle={customTooltipStyle} />
        <Bar dataKey="y" fill={SAGE[700]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Main Charts Component
// ---------------------------------------------------------------------------

export function Charts() {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [connectionNotes, setConnectionNotes] = useState<ConnectionNote[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);

  const [tables, setTables] = useState<TableSchema[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);

  const [savedCharts, setSavedCharts] = useState<SavedChart[]>([]);
  const [savedChartsLoading, setSavedChartsLoading] = useState(true);

  const [builderMode, setBuilderMode] = useState<BuilderMode>("ai");

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiChartHint, setAiChartHint] = useState<ChartType | "auto">("auto");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [manualTitle, setManualTitle] = useState("New visualization");
  const [manualDescription, setManualDescription] = useState("");
  const [manualSql, setManualSql] = useState("SELECT 1 AS x, 1 AS y");
  const [manualChartType, setManualChartType] = useState<ChartType>("bar");
  const [manualColumns, setManualColumns] = useState<string[]>([]);
  const [manualXKey, setManualXKey] = useState("");
  const [manualYKey, setManualYKey] = useState("");
  const [manualRows, setManualRows] = useState<Record<string, unknown>[]>([]);
  const [manualExecutionTime, setManualExecutionTime] = useState<number | null>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const [preview, setPreview] = useState<ChartPreview | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const selectedConnection = connections.find((c) => c.id === selectedConnectionId);

  const refreshSavedCharts = useCallback(async () => {
    setSavedChartsLoading(true);
    try {
      const charts = await listSavedCharts();
      setSavedCharts(charts);
    } catch {
      setSavedCharts([]);
    } finally {
      setSavedChartsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      listConnections(),
      listSavedCharts(),
      listConnectionNotes(),
      listSavedQueries(),
    ])
      .then(([conns, charts, notes, queries]) => {
        setConnections(conns);
        setSavedCharts(charts);
        setConnectionNotes(notes);
        setSavedQueries(queries);
        if (conns.length > 0) setSelectedConnectionId((prev) => prev || conns[0].id);
      })
      .catch(() => {
        setConnections([]);
        setSavedCharts([]);
        setConnectionNotes([]);
        setSavedQueries([]);
      })
      .finally(() => {
        setConnectionsLoading(false);
        setSavedChartsLoading(false);
      });
  }, []);

  useEffect(() => {
    const onSavedChartsUpdated = () => {
      void refreshSavedCharts();
    };
    window.addEventListener("arc:saved-charts-updated", onSavedChartsUpdated);
    return () => {
      window.removeEventListener("arc:saved-charts-updated", onSavedChartsUpdated);
    };
  }, [refreshSavedCharts]);

  useEffect(() => {
    if (!selectedConnectionId) {
      setTables([]);
      return;
    }
    setSchemaLoading(true);
    getSchema(selectedConnectionId)
      .then(setTables)
      .catch(() => setTables([]))
      .finally(() => setSchemaLoading(false));
  }, [selectedConnectionId]);

  const manualChartData = useMemo(
    () => toChartData(manualRows, manualXKey, manualYKey),
    [manualRows, manualXKey, manualYKey]
  );

  useEffect(() => {
    if (!preview || preview.source !== "manual") return;
    setPreview({
      ...preview,
      title: manualTitle,
      description: manualDescription,
      chartType: manualChartType,
      xKey: manualXKey,
      yKey: manualYKey,
      points: manualChartData,
    });
  }, [manualTitle, manualDescription, manualChartType, manualXKey, manualYKey, manualChartData]);

  const runSqlForPlan = useCallback(
    async (plan: ChartPlan, source: "ai" | "manual") => {
      if (!selectedConnectionId) {
        throw new Error("Select a database connection first.");
      }
      if (!isReadOnlySql(plan.sql)) {
        throw new Error("Only read-only SELECT/WITH SQL is supported for visualizations.");
      }

      const result = await executeQuery(selectedConnectionId, plan.sql);
      const rows = toObjectRows(result).slice(0, 500);
      const availableCols = result.columns;

      const xKey = availableCols.includes(plan.xKey) ? plan.xKey : (availableCols[0] || plan.xKey);
      const preferredY = availableCols.includes(plan.yKey)
        ? plan.yKey
        : availableCols.find((col) => rows.some((r) => isNumericValue(r[col])));
      const yKey = preferredY || availableCols[1] || availableCols[0] || plan.yKey;

      const points = toChartData(rows, xKey, yKey);
      if (points.length === 0) {
        throw new Error("No plottable rows found. Ensure the selected y-axis contains numeric values.");
      }

      if (source === "manual") {
        setManualColumns(availableCols);
        setManualRows(rows);
        setManualXKey(xKey);
        setManualYKey(yKey);
        setManualExecutionTime(result.execution_time_ms);
      }

      setPreview({
        title: plan.title,
        description: plan.description,
        chartType: plan.chartType,
        connectionId: selectedConnectionId,
        sql: plan.sql,
        xKey,
        yKey,
        dataRows: rows,
        points,
        executionTimeMs: result.execution_time_ms,
        source,
      });
    },
    [selectedConnectionId]
  );

  const handleGenerateAiChart = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setSaveStatus("idle");

    try {
      let plan: ChartPlan;
      try {
        plan = await buildModelPlan(aiPrompt.trim(), tables, aiChartHint, {
          connectionId: selectedConnectionId,
          connectionNotes: connectionNotes.filter((n) => n.connection_id === selectedConnectionId),
          savedQueries: savedQueries.filter((q) => q.connection_id === selectedConnectionId),
        });
      } catch {
        plan = buildHeuristicPlan(aiPrompt.trim(), tables);
      }

      if (aiChartHint !== "auto") {
        plan.chartType = aiChartHint;
      }

      await runSqlForPlan(plan, "ai");

      setManualTitle(plan.title);
      setManualDescription(plan.description);
      setManualSql(plan.sql);
      setManualChartType(plan.chartType);
      setBuilderMode("manual");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, tables, aiChartHint, runSqlForPlan, selectedConnectionId, connectionNotes, savedQueries]);

  const handleRunManualTest = useCallback(async () => {
    setManualError(null);
    setManualLoading(true);
    setSaveStatus("idle");

    try {
      const plan: ChartPlan = {
        title: manualTitle.trim() || "New visualization",
        description: manualDescription.trim(),
        chartType: manualChartType,
        sql: manualSql,
        xKey: manualXKey || "x",
        yKey: manualYKey || "y",
      };
      await runSqlForPlan(plan, "manual");
    } catch (err) {
      setManualError(err instanceof Error ? err.message : String(err));
    } finally {
      setManualLoading(false);
    }
  }, [manualTitle, manualDescription, manualChartType, manualSql, manualXKey, manualYKey, runSqlForPlan]);

  const handleSavePreview = useCallback(async () => {
    if (!preview) return;
    if (preview.points.length === 0) return;

    setSaveStatus("saving");
    try {
      await saveSavedChart({
        name: preview.title,
        description: preview.description,
        chartType: preview.chartType,
        xKey: preview.xKey,
        yKey: preview.yKey,
        connectionId: preview.connectionId,
        sql: preview.sql,
        data: preview.dataRows,
      });
      setSaveStatus("saved");
      await refreshSavedCharts();
      window.dispatchEvent(new Event("arc:saved-charts-updated"));
      setTimeout(() => setSaveStatus("idle"), 2200);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [preview, refreshSavedCharts]);

  const handleOpenSavedChart = useCallback((chart: SavedChart) => {
    const rows = Array.isArray(chart.data) ? chart.data : [];
    const points = toChartData(rows, chart.x_key, chart.y_key);
    setPreview({
      title: chart.name,
      description: chart.description,
      chartType: chart.chart_type,
      connectionId: chart.connection_id || selectedConnectionId,
      sql: chart.sql || "",
      xKey: chart.x_key,
      yKey: chart.y_key,
      dataRows: rows,
      points,
      executionTimeMs: null,
      source: "saved",
    });
    setBuilderMode("manual");
    setManualTitle(chart.name);
    setManualDescription(chart.description);
    setManualSql(chart.sql || "SELECT 1 AS x, 1 AS y");
    setManualChartType(chart.chart_type);
    setManualRows(rows);
    const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
    setManualColumns(cols);
    setManualXKey(chart.x_key);
    setManualYKey(chart.y_key);
  }, [selectedConnectionId]);

  const handleDeleteSavedChart = useCallback(async (id: string) => {
    try {
      await deleteSavedChart(id);
      await refreshSavedCharts();
    } catch {
      // ignore deletion failures in UI
    }
  }, [refreshSavedCharts]);

  const handleRerunSavedChart = useCallback(async (chart: SavedChart) => {
    if (!chart.connection_id || !chart.sql) return;
    setSelectedConnectionId(chart.connection_id);
    setManualTitle(chart.name);
    setManualDescription(chart.description);
    setManualSql(chart.sql);
    setManualChartType(chart.chart_type);
    setManualXKey(chart.x_key);
    setManualYKey(chart.y_key);
    setBuilderMode("manual");

    setManualLoading(true);
    setManualError(null);
    try {
      await runSqlForPlan(
        {
          title: chart.name,
          description: chart.description,
          chartType: chart.chart_type,
          sql: chart.sql,
          xKey: chart.x_key,
          yKey: chart.y_key,
        },
        "manual",
      );
    } catch (err) {
      setManualError(err instanceof Error ? err.message : String(err));
    } finally {
      setManualLoading(false);
    }
  }, [runSqlForPlan]);

  if (!connectionsLoading && connections.length === 0) {
    return (
      <div style={{ flex: 1, overflow: "auto", padding: 32 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <h1 style={{ fontFamily: FONTS.display, fontSize: 28, fontWeight: 400, color: SAGE[900], margin: "0 0 24px" }}>
            Charts
          </h1>
          <Card>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px", gap: 12 }}>
              <Database size={36} strokeWidth={1} color={SAGE[300]} />
              <h2 style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 400, color: SAGE[700], margin: 0 }}>
                Connect a database first
              </h2>
              <p style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[400], margin: 0, textAlign: "center", maxWidth: 360 }}>
                Add a database connection in Connections to create and save visualizations.
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const connectionOptions = connections.map((c) => ({
    value: c.id,
    label: `${c.name} (${c.db_type})`,
  }));

  const axisOptions = manualColumns.map((col) => ({
    value: col,
    label: col,
  }));

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 28 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontSize: 28, fontWeight: 400, color: SAGE[900], margin: 0 }}>
            Charts
          </h1>
          <p style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[500], marginTop: 4 }}>
            Saved visualizations, AI-assisted generation, and SQL-first manual chart creation.
          </p>
        </div>

        <Card style={{ padding: 0 }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${SAGE[100]}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: SAGE[900] }}>Saved Visualizations</div>
              <div style={{ fontFamily: FONTS.body, fontSize: 12, color: SAGE[500], marginTop: 2 }}>Reopen and rerun charts created from conversations or the builder.</div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void refreshSavedCharts()}>
              <RefreshCw size={13} /> Refresh
            </Button>
          </div>

          <div style={{ padding: "12px 14px" }}>
            {savedChartsLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: SAGE[500], fontFamily: FONTS.body, fontSize: 12 }}>
                <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading charts...
              </div>
            ) : savedCharts.length === 0 ? (
              <div style={{ fontFamily: FONTS.body, fontSize: 12, color: SAGE[400], padding: "6px 2px" }}>
                No saved visualizations yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {savedCharts.map((chart) => (
                  <div key={chart.id} style={{ border: `1px solid ${SAGE[100]}`, background: CREAM[50], padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: SAGE[900], overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {chart.name}
                      </div>
                      {chart.description && (
                        <div style={{ fontFamily: FONTS.body, fontSize: 12, color: SAGE[500], marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {chart.description}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                        <Tag>{chart.chart_type.toUpperCase()}</Tag>
                        <Tag>{`${chart.x_key} -> ${chart.y_key}`}</Tag>
                        <Tag>{new Date(chart.created_at).toLocaleString()}</Tag>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <Button variant="secondary" size="sm" onClick={() => handleOpenSavedChart(chart)}>Open</Button>
                      {chart.sql && chart.connection_id && (
                        <Button variant="secondary" size="sm" onClick={() => void handleRerunSavedChart(chart)}>
                          <RefreshCw size={12} /> Re-run
                        </Button>
                      )}
                      <button
                        onClick={() => void handleDeleteSavedChart(chart.id)}
                        title="Delete"
                        style={{
                          width: 30,
                          height: 30,
                          border: `1px solid ${SAGE[200]}`,
                          background: "transparent",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={13} color={SAGE[500]} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(420px, 520px) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
          <Card style={{ padding: 0 }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${SAGE[100]}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: SAGE[900] }}>Visualization Builder</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setBuilderMode("ai")}
                  style={{
                    border: `1px solid ${builderMode === "ai" ? SAGE[900] : SAGE[200]}`,
                    background: builderMode === "ai" ? SAGE[900] : "transparent",
                    color: builderMode === "ai" ? CREAM[50] : SAGE[700],
                    fontFamily: FONTS.mono,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  AI
                </button>
                <button
                  onClick={() => setBuilderMode("manual")}
                  style={{
                    border: `1px solid ${builderMode === "manual" ? SAGE[900] : SAGE[200]}`,
                    background: builderMode === "manual" ? SAGE[900] : "transparent",
                    color: builderMode === "manual" ? CREAM[50] : SAGE[700],
                    fontFamily: FONTS.mono,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  Manual
                </button>
              </div>
            </div>

            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ ...mixins.label, display: "block", marginBottom: 6 }}>Connection</label>
                <StyledSelect
                  value={selectedConnectionId}
                  onChange={setSelectedConnectionId}
                  options={connectionOptions}
                  placeholder={connectionsLoading ? "Loading..." : "Select connection"}
                  disabled={connectionsLoading}
                />
                {schemaLoading && (
                  <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[400], marginTop: 6 }}>
                    Loading schema...
                  </div>
                )}
              </div>

              {builderMode === "ai" ? (
                <>
                  <div>
                    <label style={{ ...mixins.label, display: "block", marginBottom: 6 }}>Describe what you want</label>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Example: show me monthly revenue trend for this year"
                      style={{
                        ...mixins.input,
                        width: "100%",
                        minHeight: 90,
                        resize: "vertical",
                        padding: "10px 12px",
                        fontFamily: FONTS.body,
                        fontSize: 13,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ ...mixins.label, display: "block", marginBottom: 6 }}>Chart hint</label>
                    <StyledSelect
                      value={aiChartHint}
                      onChange={(v) => setAiChartHint(v as ChartType | "auto")}
                      options={[
                        { value: "auto", label: "Auto" },
                        ...CHART_TYPE_OPTIONS.map((o) => ({ value: o.type, label: o.label })),
                      ]}
                      placeholder="Auto"
                    />
                  </div>
                  <Button variant="primary" size="sm" disabled={!selectedConnectionId || !aiPrompt.trim() || aiLoading} onClick={() => void handleGenerateAiChart()}>
                    {aiLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
                    {aiLoading ? "Generating..." : "Generate Chart"}
                  </Button>
                  {aiError && (
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#b94a48" }}>
                      <AlertTriangle size={14} style={{ marginTop: 1 }} />
                      <span style={{ fontFamily: FONTS.body, fontSize: 12 }}>{aiError}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label style={{ ...mixins.label, display: "block", marginBottom: 6 }}>Chart title</label>
                    <input
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      style={{ ...mixins.input, width: "100%", padding: "8px 12px", fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ ...mixins.label, display: "block", marginBottom: 6 }}>Description</label>
                    <input
                      value={manualDescription}
                      onChange={(e) => setManualDescription(e.target.value)}
                      placeholder="Optional"
                      style={{ ...mixins.input, width: "100%", padding: "8px 12px", fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ ...mixins.label, display: "block", marginBottom: 6 }}>SQL</label>
                    <textarea
                      value={manualSql}
                      onChange={(e) => setManualSql(e.target.value)}
                      placeholder="SELECT ..."
                      style={{
                        ...mixins.input,
                        width: "100%",
                        minHeight: 110,
                        resize: "vertical",
                        padding: "10px 12px",
                        fontFamily: FONTS.mono,
                        fontSize: 12,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ ...mixins.label, display: "block", marginBottom: 6 }}>Chart type</label>
                    <StyledSelect
                      value={manualChartType}
                      onChange={(v) => setManualChartType(v as ChartType)}
                      options={CHART_TYPE_OPTIONS.map((o) => ({ value: o.type, label: o.label }))}
                      placeholder="Chart type"
                    />
                  </div>

                  <Button variant="secondary" size="sm" disabled={!selectedConnectionId || !manualSql.trim() || manualLoading} onClick={() => void handleRunManualTest()}>
                    {manualLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Beaker size={14} />}
                    {manualLoading ? "Running Test..." : "Run Test"}
                  </Button>

                  {manualColumns.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={{ ...mixins.label, display: "block", marginBottom: 6 }}>X axis binding</label>
                        <StyledSelect
                          value={manualXKey}
                          onChange={setManualXKey}
                          options={axisOptions}
                          placeholder="Select x column"
                        />
                      </div>
                      <div>
                        <label style={{ ...mixins.label, display: "block", marginBottom: 6 }}>Y axis binding</label>
                        <StyledSelect
                          value={manualYKey}
                          onChange={setManualYKey}
                          options={axisOptions}
                          placeholder="Select y column"
                        />
                      </div>
                    </div>
                  )}

                  {manualError && (
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#b94a48" }}>
                      <AlertTriangle size={14} style={{ marginTop: 1 }} />
                      <span style={{ fontFamily: FONTS.body, fontSize: 12 }}>{manualError}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {preview ? (
              <>
                <ChartCard
                  title={preview.title}
                  description={preview.executionTimeMs !== null
                    ? `${preview.points.length} data points in ${preview.executionTimeMs}ms`
                    : `${preview.points.length} data points`}
                  tags={[
                    selectedConnection?.name || preview.connectionId,
                    preview.chartType.toUpperCase(),
                    preview.source.toUpperCase(),
                  ]}
                >
                  <ChartRenderer
                    data={preview.points}
                    chartType={preview.chartType}
                    xLabel={preview.xKey}
                    yLabel={preview.yKey}
                  />
                </ChartCard>

                <Card style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontFamily: FONTS.body, fontSize: 12, fontWeight: 600, color: SAGE[900] }}>Chart SQL</div>
                    <Button variant="primary" size="sm" disabled={saveStatus === "saving"} onClick={() => void handleSavePreview()}>
                      {saveStatus === "saving" ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
                      {saveStatus === "saving" ? "Saving..." : "Save Visualization"}
                    </Button>
                  </div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: FONTS.mono, fontSize: 11, color: SAGE[200], background: SAGE[950], padding: "10px 12px", overflowX: "auto" }}>
                    {preview.sql}
                  </pre>
                  {saveStatus === "saved" && (
                    <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[500], marginTop: 8 }}>
                      Visualization saved.
                    </div>
                  )}
                  {saveStatus === "error" && (
                    <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: "#b94a48", marginTop: 8 }}>
                      Failed to save visualization.
                    </div>
                  )}
                </Card>
              </>
            ) : (
              <Card>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 28px", gap: 12 }}>
                  <BarChart3 size={36} strokeWidth={1} color={SAGE[300]} />
                  <h2 style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 400, color: SAGE[700], margin: 0 }}>
                    Build or open a visualization
                  </h2>
                  <p style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[400], margin: 0, textAlign: "center", maxWidth: 420 }}>
                    Use AI to describe a chart, or manually define SQL and bind columns to chart axes. Run a test first, then save.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
