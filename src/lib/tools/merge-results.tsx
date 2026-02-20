import { z } from "zod";
import { defineTool } from "glove-react";
import { DataTable } from "../../components/DataTable";
import { ErrorDisplay } from "../../components/ErrorDisplay";
import { SAGE, FONTS } from "../theme";
import { parseRenderData } from "./render-data";

type MergeType = "inner" | "left" | "right" | "full";
type CellValue = string | number | boolean | null;

const MAX_ROWS_FOR_MODEL = 50;
const DEFAULT_MAX_ROWS = 500;

type RowObject = Record<string, unknown>;

interface IndexedRightRow {
  row: RowObject;
  index: number;
}

interface MergeStats {
  leftRows: number;
  rightRows: number;
  matchedPairs: number;
  unmatchedLeft: number;
  unmatchedRight: number;
}

function normalizeJoinValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? `num:${value}` : `str:${String(value)}`;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const asNumber = Number(trimmed);
      if (Number.isFinite(asNumber)) return `num:${asNumber}`;
    }
    return `str:${value}`;
  }
  if (typeof value === "boolean") return `bool:${value}`;
  if (typeof value === "bigint") return `num:${value.toString()}`;
  try {
    return `json:${JSON.stringify(value)}`;
  } catch {
    return `str:${String(value)}`;
  }
}

function toCellValue(value: unknown): CellValue {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function uniqueKeys(rows: RowObject[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) seen.add(key);
  }
  return Array.from(seen);
}

function buildMergedRow(
  leftRow: RowObject | null,
  rightRow: RowObject | null,
  leftKeys: string[],
  rightKeys: string[],
  leftPrefix: string,
  rightPrefix: string
): RowObject {
  const merged: RowObject = {};
  for (const key of leftKeys) {
    merged[`${leftPrefix}.${key}`] = leftRow ? (leftRow[key] ?? null) : null;
  }
  for (const key of rightKeys) {
    merged[`${rightPrefix}.${key}`] = rightRow ? (rightRow[key] ?? null) : null;
  }
  return merged;
}

function mergeRows(params: {
  leftRows: RowObject[];
  rightRows: RowObject[];
  leftKey: string;
  rightKey: string;
  mergeType: MergeType;
  leftPrefix: string;
  rightPrefix: string;
}): { rows: RowObject[]; columns: string[]; stats: MergeStats } {
  const {
    leftRows,
    rightRows,
    leftKey,
    rightKey,
    mergeType,
    leftPrefix,
    rightPrefix,
  } = params;

  const leftKeys = uniqueKeys(leftRows);
  const rightKeys = uniqueKeys(rightRows);
  const columns = [
    ...leftKeys.map((key) => `${leftPrefix}.${key}`),
    ...rightKeys.map((key) => `${rightPrefix}.${key}`),
  ];

  const rightIndex = new Map<string, IndexedRightRow[]>();
  for (let i = 0; i < rightRows.length; i++) {
    const key = normalizeJoinValue(rightRows[i][rightKey]);
    if (!key) continue;
    const bucket = rightIndex.get(key);
    const entry: IndexedRightRow = { row: rightRows[i], index: i };
    if (bucket) {
      bucket.push(entry);
    } else {
      rightIndex.set(key, [entry]);
    }
  }

  const merged: RowObject[] = [];
  const matchedRightIndices = new Set<number>();
  let matchedPairs = 0;
  let unmatchedLeft = 0;

  for (const leftRow of leftRows) {
    const key = normalizeJoinValue(leftRow[leftKey]);
    const matches = key ? rightIndex.get(key) : undefined;

    if (matches && matches.length > 0) {
      for (const match of matches) {
        matchedPairs += 1;
        matchedRightIndices.add(match.index);
        merged.push(
          buildMergedRow(leftRow, match.row, leftKeys, rightKeys, leftPrefix, rightPrefix)
        );
      }
      continue;
    }

    if (mergeType === "left" || mergeType === "full") {
      unmatchedLeft += 1;
      merged.push(buildMergedRow(leftRow, null, leftKeys, rightKeys, leftPrefix, rightPrefix));
    }
  }

  let unmatchedRight = 0;
  if (mergeType === "right" || mergeType === "full") {
    for (let i = 0; i < rightRows.length; i++) {
      if (matchedRightIndices.has(i)) continue;
      unmatchedRight += 1;
      merged.push(buildMergedRow(null, rightRows[i], leftKeys, rightKeys, leftPrefix, rightPrefix));
    }
  }

  return {
    rows: merged,
    columns,
    stats: {
      leftRows: leftRows.length,
      rightRows: rightRows.length,
      matchedPairs,
      unmatchedLeft,
      unmatchedRight,
    },
  };
}

const datasetSchema = z.object({
  connectionId: z
    .string()
    .optional()
    .describe("Optional source connection id used for this dataset"),
  label: z
    .string()
    .optional()
    .describe("Optional source label for display (e.g. users_db, billing_db)"),
  rows: z
    .array(z.record(z.string(), z.unknown()))
    .describe("Rows as objects, usually from execute_query tool output"),
});

const inputSchema = z.object({
  left: datasetSchema.describe("Left dataset"),
  right: datasetSchema.describe("Right dataset"),
  leftKey: z.string().describe("Join key field name in left dataset"),
  rightKey: z.string().describe("Join key field name in right dataset"),
  mergeType: z
    .enum(["inner", "left", "right", "full"])
    .default("inner")
    .describe("Join strategy"),
  leftPrefix: z
    .string()
    .default("left")
    .describe("Prefix for left output columns"),
  rightPrefix: z
    .string()
    .default("right")
    .describe("Prefix for right output columns"),
  maxRows: z
    .number()
    .int()
    .min(1)
    .max(5000)
    .default(DEFAULT_MAX_ROWS)
    .describe("Maximum merged rows to render"),
  title: z
    .string()
    .optional()
    .describe("Optional title shown in the merged result card"),
});

const mergeStatsSchema = z.object({
  leftRows: z.number(),
  rightRows: z.number(),
  matchedPairs: z.number(),
  unmatchedLeft: z.number(),
  unmatchedRight: z.number(),
});

const displayPropsSchema = z.object({
  title: z.string(),
  mergeType: z.enum(["inner", "left", "right", "full"]),
  leftLabel: z.string(),
  rightLabel: z.string(),
  leftConnectionId: z.string().nullable(),
  rightConnectionId: z.string().nullable(),
  leftKey: z.string(),
  rightKey: z.string(),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))),
  rowCount: z.number(),
  totalRowCount: z.number(),
  truncated: z.boolean(),
  stats: mergeStatsSchema,
  error: z.string().nullable(),
});

export const mergeResultsTool = defineTool({
  name: "merge_query_results",
  description:
    "Merge/interpolate two previously-fetched datasets (including from different connections) by keys and render the merged table. Use this after execute_query by passing the object rows from tool output.",
  inputSchema,
  displayPropsSchema,
  resolveSchema: z.void(),
  async do(input, display) {
    try {
      const leftRows = input.left.rows;
      const rightRows = input.right.rows;
      const leftLabel = input.left.label || input.left.connectionId || "left";
      const rightLabel = input.right.label || input.right.connectionId || "right";

      const hasLeftKey = leftRows.some((row) => Object.prototype.hasOwnProperty.call(row, input.leftKey));
      const hasRightKey = rightRows.some((row) => Object.prototype.hasOwnProperty.call(row, input.rightKey));
      if (!hasLeftKey || !hasRightKey) {
        const missing = [
          !hasLeftKey ? `leftKey "${input.leftKey}"` : null,
          !hasRightKey ? `rightKey "${input.rightKey}"` : null,
        ]
          .filter((v): v is string => Boolean(v))
          .join(", ");
        throw new Error(`Missing join key(s): ${missing}`);
      }

      const merged = mergeRows({
        leftRows,
        rightRows,
        leftKey: input.leftKey,
        rightKey: input.rightKey,
        mergeType: input.mergeType,
        leftPrefix: input.leftPrefix,
        rightPrefix: input.rightPrefix,
      });

      const totalRowCount = merged.rows.length;
      const renderedRows = merged.rows.slice(0, input.maxRows);
      const truncated = totalRowCount > renderedRows.length;
      const tableRows = renderedRows.map((row) =>
        merged.columns.map((col) => toCellValue(row[col]))
      );

      const title =
        input.title ||
        `Merged ${leftLabel} (${input.leftKey}) ${input.mergeType.toUpperCase()} ${rightLabel} (${input.rightKey})`;

      const renderPayload = {
        title,
        mergeType: input.mergeType,
        leftLabel,
        rightLabel,
        leftConnectionId: input.left.connectionId || null,
        rightConnectionId: input.right.connectionId || null,
        leftKey: input.leftKey,
        rightKey: input.rightKey,
        columns: merged.columns,
        rows: tableRows,
        rowCount: renderedRows.length,
        totalRowCount,
        truncated,
        stats: merged.stats,
        error: null,
      };

      await display.pushAndForget(renderPayload);

      return {
        status: "success",
        data: {
          title,
          mergeType: input.mergeType,
          rowCount: totalRowCount,
          rowsProvided: Math.min(renderedRows.length, MAX_ROWS_FOR_MODEL),
          columns: merged.columns,
          rows: renderedRows.slice(0, MAX_ROWS_FOR_MODEL),
          rowsTruncated: totalRowCount > MAX_ROWS_FOR_MODEL,
          stats: merged.stats,
          leftConnectionId: input.left.connectionId || null,
          rightConnectionId: input.right.connectionId || null,
          leftKey: input.leftKey,
          rightKey: input.rightKey,
        },
        renderData: renderPayload,
      };
    } catch (e) {
      const errorMsg = typeof e === "string" ? e : (e as Error).message || "Failed to merge query results";
      const leftLabel = input.left.label || input.left.connectionId || "left";
      const rightLabel = input.right.label || input.right.connectionId || "right";
      const title =
        input.title ||
        `Merged ${leftLabel} (${input.leftKey}) ${input.mergeType.toUpperCase()} ${rightLabel} (${input.rightKey})`;

      const errorPayload = {
        title,
        mergeType: input.mergeType,
        leftLabel,
        rightLabel,
        leftConnectionId: input.left.connectionId || null,
        rightConnectionId: input.right.connectionId || null,
        leftKey: input.leftKey,
        rightKey: input.rightKey,
        columns: [] as string[],
        rows: [] as CellValue[][],
        rowCount: 0,
        totalRowCount: 0,
        truncated: false,
        stats: {
          leftRows: input.left.rows.length,
          rightRows: input.right.rows.length,
          matchedPairs: 0,
          unmatchedLeft: 0,
          unmatchedRight: 0,
        },
        error: errorMsg,
      };

      await display.pushAndForget(errorPayload);
      return {
        status: "error",
        data: {
          error: errorMsg,
          mergeType: input.mergeType,
          leftConnectionId: input.left.connectionId || null,
          rightConnectionId: input.right.connectionId || null,
          leftKey: input.leftKey,
          rightKey: input.rightKey,
        },
        message: errorMsg,
        renderData: errorPayload,
      };
    }
  },
  render({ props }) {
    const parsed = parseRenderData(displayPropsSchema, props);
    if (!parsed) return null;
    return <MergeResultsCard data={parsed} />;
  },
  renderResult({ data }) {
    const parsed = parseRenderData(displayPropsSchema, data);
    if (!parsed) return null;
    return <MergeResultsCard data={parsed} />;
  },
});

function MergeResultsCard({
  data,
}: {
  data: z.infer<typeof displayPropsSchema>;
}) {
  const {
    title,
    mergeType,
    leftLabel,
    rightLabel,
    leftConnectionId,
    rightConnectionId,
    leftKey,
    rightKey,
    columns,
    rows,
    totalRowCount,
    truncated,
    stats,
    error,
  } = data;

  if (error) {
    return (
      <ErrorDisplay
        title="Merge Error"
        message={error}
        detail={`${leftLabel}.${leftKey} ${mergeType.toUpperCase()} ${rightLabel}.${rightKey}`}
        style={{ marginTop: 8 }}
      />
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          background: SAGE[950],
          padding: "10px 12px",
          marginBottom: 8,
          fontFamily: FONTS.mono,
          fontSize: 11,
          color: "#e0e0e0",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span>{title}</span>
        <span>{mergeType.toUpperCase()}</span>
        <span>{leftLabel}.{leftKey}</span>
        <span>{rightLabel}.{rightKey}</span>
        {leftConnectionId && <span>L: {leftConnectionId}</span>}
        {rightConnectionId && <span>R: {rightConnectionId}</span>}
      </div>

      <DataTable columns={columns} rows={rows} />

      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 6,
          fontFamily: FONTS.mono,
          fontSize: 11,
          color: SAGE[400],
          flexWrap: "wrap",
        }}
      >
        <span>{totalRowCount} merged rows</span>
        <span>matched: {stats.matchedPairs}</span>
        <span>unmatched-left: {stats.unmatchedLeft}</span>
        <span>unmatched-right: {stats.unmatchedRight}</span>
        {truncated && <span>render truncated</span>}
      </div>
    </div>
  );
}
