import { useState, useEffect, useCallback } from "react";
import { SAGE, CREAM, FONTS, mixins } from "../lib/theme";
import { Card } from "../components/Card";
import { Tag } from "../components/Tag";
import { Button } from "../components/Button";
import {
  listConnections,
  getSchema,
  executeQuery,
} from "../lib/commands";
import type {
  DatabaseConnection,
  TableSchema,
  ColumnInfo,
  QueryResult,
} from "../lib/commands";

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
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChartType = "bar" | "line" | "area" | "pie";
type Aggregation = "NONE" | "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";

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

const AGGREGATION_OPTIONS: { value: Aggregation; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "COUNT", label: "COUNT" },
  { value: "SUM", label: "SUM" },
  { value: "AVG", label: "AVG" },
  { value: "MIN", label: "MIN" },
  { value: "MAX", label: "MAX" },
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

function buildSql(
  table: string,
  xCol: string,
  yCol: string,
  agg: Aggregation
): string {
  const t = quoteIdentifier(table);
  const x = quoteIdentifier(xCol);
  const y = quoteIdentifier(yCol);

  if (agg === "NONE") {
    return `SELECT ${x}, ${y} FROM ${t} LIMIT 100`;
  }
  return `SELECT ${x}, ${agg}(${y}) AS value FROM ${t} GROUP BY ${x} ORDER BY value DESC LIMIT 50`;
}

function parseQueryResultToChartData(
  result: QueryResult,
  xColName: string,
  yColName: string
): ChartDataPoint[] {
  const xIndex = result.columns.indexOf(xColName);
  const yIndex = result.columns.indexOf(yColName);
  if (xIndex === -1 || yIndex === -1) return [];

  return result.rows
    .map((row) => {
      const xValue = row[xIndex];
      const yValue = row[yIndex];
      const numericY = typeof yValue === "number" ? yValue : Number(yValue);
      if (isNaN(numericY)) return null;
      return { x: xValue == null ? "(null)" : String(xValue), y: numericY };
    })
    .filter((p): p is ChartDataPoint => p !== null);
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
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        ...mixins.input,
        width: "auto",
        minWidth: 140,
        padding: "8px 12px",
        fontSize: 12,
        fontFamily: FONTS.body,
        color: value ? SAGE[900] : SAGE[400],
        appearance: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
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
            <div key={String(point.x)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
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
          <XAxis dataKey="x" tick={axisTickStyle} axisLine={{ stroke: SAGE[100] }} tickLine={false}
            label={{ value: xLabel, position: "insideBottom", offset: -5, style: axisLabelStyle }} />
          <YAxis tick={axisTickStyle} axisLine={false} tickLine={false}
            label={{ value: yLabel, angle: -90, position: "insideLeft", style: axisLabelStyle }} />
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
          <XAxis dataKey="x" tick={axisTickStyle} axisLine={{ stroke: SAGE[100] }} tickLine={false}
            label={{ value: xLabel, position: "insideBottom", offset: -5, style: axisLabelStyle }} />
          <YAxis tick={axisTickStyle} axisLine={false} tickLine={false}
            label={{ value: yLabel, angle: -90, position: "insideLeft", style: axisLabelStyle }} />
          <Tooltip contentStyle={customTooltipStyle} />
          <Line type="monotone" dataKey="y" stroke={SAGE[700]} strokeWidth={2} dot={{ fill: SAGE[700], r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Bar (default)
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={SAGE[100]} />
        <XAxis dataKey="x" tick={axisTickStyle} axisLine={{ stroke: SAGE[100] }} tickLine={false}
          label={{ value: xLabel, position: "insideBottom", offset: -5, style: axisLabelStyle }} />
        <YAxis tick={axisTickStyle} axisLine={false} tickLine={false}
          label={{ value: yLabel, angle: -90, position: "insideLeft", style: axisLabelStyle }} />
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
  // Connection state
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");

  // Schema state
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState("");

  // Chart config
  const [xColumn, setXColumn] = useState("");
  const [yColumn, setYColumn] = useState("");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [aggregation, setAggregation] = useState<Aggregation>("NONE");

  // Query result
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [generatedSql, setGeneratedSql] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  // Derived
  const selectedTableSchema = tables.find((t) => t.name === selectedTable);
  const allColumns = selectedTableSchema?.columns ?? [];
  const numericColumns = allColumns.filter(isNumericColumn);
  const selectedConnection = connections.find((c) => c.id === selectedConnectionId);
  const canRun = selectedConnectionId && selectedTable && xColumn && yColumn;

  // Load connections
  useEffect(() => {
    listConnections()
      .then((conns) => {
        setConnections(conns);
        if (conns.length === 1) setSelectedConnectionId(conns[0].id);
      })
      .catch(() => {})
      .finally(() => setConnectionsLoading(false));
  }, []);

  // Load schema when connection changes
  useEffect(() => {
    if (!selectedConnectionId) {
      setTables([]);
      return;
    }
    setSchemaLoading(true);
    setTables([]);
    setSelectedTable("");
    setXColumn("");
    setYColumn("");
    getSchema(selectedConnectionId)
      .then(setTables)
      .catch(() => setTables([]))
      .finally(() => setSchemaLoading(false));
  }, [selectedConnectionId]);

  // Reset columns when table changes
  useEffect(() => {
    setXColumn("");
    setYColumn("");
  }, [selectedTable]);

  const handleRun = useCallback(() => {
    if (!canRun) return;
    const sql = buildSql(selectedTable, xColumn, yColumn, aggregation);
    setGeneratedSql(sql);
    setQueryLoading(true);
    setQueryError(null);
    setChartData([]);
    setExecutionTimeMs(null);
    setHasRun(true);

    executeQuery(selectedConnectionId, sql)
      .then((result: QueryResult) => {
        setExecutionTimeMs(result.execution_time_ms);
        const yColName = aggregation === "NONE" ? yColumn : "value";
        const data = parseQueryResultToChartData(result, xColumn, yColName);
        if (data.length === 0) {
          setQueryError("No plottable data. Ensure Y axis contains numeric values.");
        } else {
          setChartData(data);
        }
      })
      .catch((err: unknown) => {
        setQueryError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setQueryLoading(false));
  }, [canRun, selectedConnectionId, selectedTable, xColumn, yColumn, aggregation]);

  // No connections state
  if (!connectionsLoading && connections.length === 0) {
    return (
      <div style={{ flex: 1, overflow: "auto", padding: 32 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
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
                Add a database connection in Connections to start creating visualizations.
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const connectionOptions = connections.map((c) => ({ value: c.id, label: `${c.name} (${c.db_type})` }));
  const tableOptions = tables.map((t) => ({ value: t.name, label: `${t.name} (${t.row_count.toLocaleString()} rows)` }));
  const xColumnOptions = allColumns.map((c) => ({ value: c.name, label: `${c.name} (${c.data_type})` }));
  const yColumnOptions = numericColumns.map((c) => ({ value: c.name, label: `${c.name} (${c.data_type})` }));
  const aggregationOptions = AGGREGATION_OPTIONS.map((a) => ({ value: a.value, label: a.label }));
  const yLabel = aggregation === "NONE" ? yColumn : `${aggregation}(${yColumn})`;

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 32 }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: FONTS.display, fontSize: 28, fontWeight: 400, color: SAGE[900], margin: 0 }}>
            Charts
          </h1>
          <p style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[500], marginTop: 4 }}>
            Visualizations from your data
          </p>
        </div>

        {/* Configuration Panel */}
        <Card style={{ padding: 0, marginBottom: 24 }}>
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <label style={{ ...mixins.label, display: "block", marginBottom: 6 }}>Connection</label>
                <StyledSelect value={selectedConnectionId} onChange={setSelectedConnectionId} options={connectionOptions} placeholder="Select connection" />
              </div>
              <div>
                <label style={{ ...mixins.label, display: "block", marginBottom: 6 }}>Table</label>
                <StyledSelect value={selectedTable} onChange={setSelectedTable} options={tableOptions}
                  placeholder={schemaLoading ? "Loading..." : "Select table"} disabled={!selectedConnectionId || schemaLoading} />
              </div>
              <div>
                <label style={{ ...mixins.label, display: "block", marginBottom: 6 }}>X Axis</label>
                <StyledSelect value={xColumn} onChange={setXColumn} options={xColumnOptions} placeholder="Column" disabled={!selectedTable} />
              </div>
              <div>
                <label style={{ ...mixins.label, display: "block", marginBottom: 6 }}>Y Axis</label>
                <StyledSelect value={yColumn} onChange={setYColumn} options={yColumnOptions}
                  placeholder={selectedTable && numericColumns.length === 0 ? "No numeric cols" : "Column"} disabled={!selectedTable || numericColumns.length === 0} />
              </div>
              <div>
                <label style={{ ...mixins.label, display: "block", marginBottom: 6 }}>Aggregation</label>
                <StyledSelect value={aggregation} onChange={(v) => setAggregation(v as Aggregation)} options={aggregationOptions} placeholder="Aggregation" />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${SAGE[100]}`, paddingTop: 12 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {CHART_TYPE_OPTIONS.map(({ type, label, Icon }) => {
                  const isActive = chartType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setChartType(type)}
                      title={label}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        border: `1px solid ${isActive ? SAGE[900] : SAGE[200]}`,
                        background: isActive ? SAGE[900] : "transparent",
                        color: isActive ? CREAM[50] : SAGE[600],
                        fontFamily: FONTS.body,
                        fontSize: 11,
                        fontWeight: 500,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Icon size={14} strokeWidth={1.5} />
                      {label}
                    </button>
                  );
                })}
              </div>
              <Button variant="primary" size="sm" onClick={handleRun} disabled={!canRun || queryLoading}>
                {queryLoading ? <Loader2 size={14} strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={14} strokeWidth={2} />}
                {queryLoading ? "Running..." : "Run"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Generated SQL */}
        {generatedSql && (
          <div style={{
            marginBottom: 16, padding: "10px 14px", background: SAGE[950],
            fontFamily: FONTS.mono, fontSize: 11, color: SAGE[200], whiteSpace: "pre-wrap", overflowX: "auto",
          }}>
            {generatedSql}
          </div>
        )}

        {/* Error */}
        {queryError && (
          <Card style={{ marginBottom: 20, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <AlertTriangle size={16} strokeWidth={1.5} color="#c45c5c" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: SAGE[900], margin: "0 0 4px" }}>Query failed</p>
                <p style={{ fontFamily: FONTS.mono, fontSize: 12, color: SAGE[600], margin: 0 }}>{queryError}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Loading */}
        {queryLoading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 64 }}>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            <Loader2 size={24} strokeWidth={1.5} color={SAGE[400]} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        )}

        {/* Chart */}
        {!queryLoading && chartData.length > 0 && (
          <ChartCard
            title={`${selectedTable}: ${xColumn} vs ${yLabel}`}
            description={executionTimeMs !== null ? `${chartData.length} data points in ${executionTimeMs}ms` : `${chartData.length} data points`}
            tags={selectedConnection ? [selectedConnection.name, chartType.toUpperCase()] : [chartType.toUpperCase()]}
          >
            <ChartRenderer data={chartData} chartType={chartType} xLabel={xColumn} yLabel={yLabel} />
          </ChartCard>
        )}

        {/* Empty state */}
        {!hasRun && !queryLoading && chartData.length === 0 && !queryError && (
          <Card>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px", gap: 12 }}>
              <BarChart3 size={36} strokeWidth={1} color={SAGE[300]} />
              <h2 style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 400, color: SAGE[700], margin: 0 }}>
                Create a visualization
              </h2>
              <p style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[400], margin: 0, textAlign: "center", maxWidth: 360 }}>
                Select a connection and configure your chart above to visualize your data.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
