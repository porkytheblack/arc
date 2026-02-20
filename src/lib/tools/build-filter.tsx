import { useState } from "react";
import { z } from "zod";
import { defineTool } from "glove-react";
import { Button } from "../../components/Button";
import { Select } from "../../components/Select";
import { SAGE, CREAM, FONTS } from "../theme";
import { Plus, X } from "lucide-react";
import { parseRenderData } from "./render-data";

interface FilterRow {
  column: string;
  operator: string;
  value: string;
}

const OPERATORS = ["=", "!=", ">", "<", ">=", "<=", "LIKE", "IN", "IS NULL", "IS NOT NULL"];

interface FilterBuilderProps {
  tableName: string;
  columns: { name: string; type: string }[];
  onApply: (filters: FilterRow[], conjunction: "AND" | "OR") => void;
  onCancel: () => void;
}

function FilterBuilderUI({ tableName, columns, onApply, onCancel }: FilterBuilderProps) {
  const [filters, setFilters] = useState<FilterRow[]>([
    { column: columns[0]?.name || "", operator: "=", value: "" },
  ]);
  const [conjunction, setConjunction] = useState<"AND" | "OR">("AND");

  const addFilter = () => {
    setFilters((prev) => [
      ...prev,
      { column: columns[0]?.name || "", operator: "=", value: "" },
    ]);
  };

  const removeFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, field: keyof FilterRow, value: string) => {
    setFilters((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    );
  };

  const hideValue = (op: string) => op === "IS NULL" || op === "IS NOT NULL";

  const inputStyle: React.CSSProperties = {
    padding: "8px 10px",
    border: `1px solid ${SAGE[200]}`,
    background: CREAM[50],
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: SAGE[900],
    outline: "none",
    appearance: "none",
    flex: 1,
  };

  return (
    <div
      style={{
        background: CREAM[50],
        border: `1px solid ${SAGE[100]}`,
        padding: 16,
        marginTop: 8,
      }}
    >
      <h3
        style={{
          fontFamily: FONTS.body,
          fontSize: 14,
          fontWeight: 600,
          color: SAGE[900],
          margin: "0 0 14px",
        }}
      >
        Filter {tableName}
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filters.map((filter, index) => (
          <div key={index}>
            {index > 0 && (
              <div
                style={{
                  textAlign: "center",
                  marginBottom: 6,
                }}
              >
                <button
                  onClick={() => setConjunction(conjunction === "AND" ? "OR" : "AND")}
                  style={{
                    background: "transparent",
                    border: `1px solid ${SAGE[200]}`,
                    padding: "2px 10px",
                    fontFamily: FONTS.mono,
                    fontSize: 10,
                    color: SAGE[500],
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {conjunction}
                </button>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Select
                value={filter.column}
                onChange={(value) => updateFilter(index, "column", value)}
                options={columns.map((col) => ({ value: col.name, label: col.name }))}
                minWidth={0}
                style={{ flex: 2 }}
              />
              <Select
                value={filter.operator}
                onChange={(value) => updateFilter(index, "operator", value)}
                options={OPERATORS.map((op) => ({ value: op, label: op }))}
                minWidth={0}
                style={{ flex: 1 }}
              />
              {!hideValue(filter.operator) && (
                <input
                  value={filter.value}
                  onChange={(e) => updateFilter(index, "value", e.target.value)}
                  placeholder="Value"
                  style={{
                    ...inputStyle,
                    flex: 2,
                  }}
                />
              )}
              {filters.length > 1 && (
                <button
                  onClick={() => removeFilter(index)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                    display: "flex",
                  }}
                >
                  <X size={14} color={SAGE[400]} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addFilter}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "8px 0",
          fontFamily: FONTS.mono,
          fontSize: 11,
          color: SAGE[500],
          marginTop: 4,
        }}
      >
        <Plus size={12} /> Add filter
      </button>

      <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => onApply(filters, conjunction)}>
          Apply Filter
        </Button>
      </div>
    </div>
  );
}

const inputSchema = z.object({
  tableName: z.string().describe("The table to filter"),
  columns: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
      })
    )
    .describe("Available columns with their types"),
});

const filterRowSchema = z.object({
  column: z.string(),
  operator: z.string(),
  value: z.string(),
});

const resolveSchema = z.union([
  z.object({
    filters: z.array(filterRowSchema),
    conjunction: z.enum(["AND", "OR"]),
  }),
  z.object({
    cancelled: z.literal(true),
  }),
]);
const renderResultSchema = z.union([
  z.object({
    tableName: z.string(),
    filters: z.array(filterRowSchema),
    conjunction: z.enum(["AND", "OR"]),
  }),
  z.object({
    tableName: z.string(),
    cancelled: z.literal(true),
  }),
]);

export const buildFilterTool = defineTool({
  name: "build_filter",
  description:
    "Show a visual WHERE clause builder for constructing query filters.",
  inputSchema,
  displayPropsSchema: inputSchema,
  resolveSchema,
  async do(input, display) {
    const outcome = await display.pushAndWait({
      tableName: input.tableName,
      columns: input.columns,
    });
    if ("cancelled" in outcome) {
      return {
        status: "success",
        data: "User cancelled the filter builder.",
        renderData: { tableName: input.tableName, cancelled: true },
      };
    }
    const clauses = outcome.filters
      .map((f: FilterRow) => {
        if (f.operator === "IS NULL" || f.operator === "IS NOT NULL") {
          return `${f.column} ${f.operator}`;
        }
        return `${f.column} ${f.operator} '${f.value}'`;
      })
      .join(` ${outcome.conjunction} `);
    return {
      status: "success",
      data: `Generated WHERE clause: WHERE ${clauses}`,
      renderData: {
        tableName: input.tableName,
        filters: outcome.filters,
        conjunction: outcome.conjunction,
      },
    };
  },
  render({ props, resolve }) {
    const { tableName, columns } = props;
    return (
      <FilterBuilderUI
        tableName={tableName}
        columns={columns}
        onApply={(filters, conjunction) => resolve({ filters, conjunction })}
        onCancel={() => resolve({ cancelled: true })}
      />
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(renderResultSchema, data);
    if (!parsed) return null;

    if ("cancelled" in parsed) {
      return (
        <div
          style={{
            background: CREAM[50],
            border: `1px solid ${SAGE[100]}`,
            padding: 12,
            marginTop: 8,
            fontFamily: FONTS.body,
            fontSize: 13,
            color: SAGE[500],
          }}
        >
          Filter builder for {parsed.tableName} was cancelled.
        </div>
      );
    }

    const where = parsed.filters
      .map((f) =>
        f.operator === "IS NULL" || f.operator === "IS NOT NULL"
          ? `${f.column} ${f.operator}`
          : `${f.column} ${f.operator} '${f.value}'`
      )
      .join(` ${parsed.conjunction} `);

    return (
      <div
        style={{
          background: CREAM[50],
          border: `1px solid ${SAGE[100]}`,
          padding: 12,
          marginTop: 8,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 13,
            fontWeight: 600,
            color: SAGE[800],
            marginBottom: 6,
          }}
        >
          Filter for {parsed.tableName}
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 11,
            color: SAGE[600],
            whiteSpace: "pre-wrap",
          }}
        >
          WHERE {where}
        </div>
      </div>
    );
  },
});
