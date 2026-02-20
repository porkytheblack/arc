import { useState } from "react";
import { z } from "zod";
import { defineTool } from "glove-react";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { SAGE, CREAM, FONTS } from "../theme";
import { parseRenderData } from "./render-data";

interface FormRendererProps {
  intent: string;
  table: string;
  columns: string[];
  onSubmit: (values: Record<string, string>) => void;
}

function FormRenderer({ intent, table, columns, onSubmit }: FormRendererProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(columns.map((col) => [col, ""]))
  );
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    const filled = Object.entries(values).filter(
      ([, v]) => v.trim() !== ""
    );
    if (filled.length === 0) return;
    setSubmitted(true);
    onSubmit(Object.fromEntries(filled));
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
      <p
        style={{
          fontFamily: FONTS.body,
          fontSize: 13,
          color: SAGE[700],
          margin: "0 0 12px",
        }}
      >
        {intent === "insert"
          ? `Fill in the values to insert a new row into ${table}.`
          : `Update the fields you want to change in ${table}.`}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {columns.map((col) => (
          <Input
            key={col}
            value={values[col]}
            onChange={(val) =>
              setValues((prev) => ({ ...prev, [col]: val }))
            }
            placeholder={`Enter ${col}`}
            label={col}
          />
        ))}
      </div>
      <div
        style={{
          marginTop: 16,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <Button size="sm" onClick={handleSubmit} disabled={submitted}>
          {submitted
            ? "Submitted"
            : intent === "insert"
              ? "Insert Row"
              : "Update Row"}
        </Button>
      </div>
    </div>
  );
}

const inputSchema = z.object({
  intent: z
    .enum(["insert", "update"])
    .describe("Whether this is an insert or update operation"),
  table: z.string().describe("The target table name"),
  columns: z
    .array(z.string())
    .describe("Column names to collect values for"),
});

const resolveSchema = z.record(z.string(), z.string());
const renderResultSchema = z.object({
  intent: z.enum(["insert", "update"]),
  table: z.string(),
  values: z.record(z.string(), z.string()),
});

export const collectFormTool = defineTool({
  name: "collect_form",
  description:
    "Show an inline form to collect field values for an INSERT or UPDATE operation.",
  inputSchema,
  displayPropsSchema: inputSchema,
  resolveSchema,
  async do(input, display) {
    const values = await display.pushAndWait({
      intent: input.intent,
      table: input.table,
      columns: input.columns,
    });
    const entries = Object.entries(values);

    if (input.intent === "insert") {
      const cols = entries.map(([k]) => k).join(", ");
      const vals = entries
        .map(([, v]) => {
          const num = Number(v);
          if (!isNaN(num) && v.trim() !== "") return v.trim();
          if (v.toLowerCase() === "true" || v.toLowerCase() === "false")
            return v.toLowerCase();
          return `'${v.replace(/'/g, "''")}'`;
        })
        .join(", ");
      return {
        status: "success",
        data: `Generated SQL: INSERT INTO ${input.table} (${cols}) VALUES (${vals})`,
        renderData: {
          intent: input.intent,
          table: input.table,
          values,
        },
      };
    }

    const setClauses = entries
      .map(([k, v]) => {
        const num = Number(v);
        if (!isNaN(num) && v.trim() !== "") return `${k} = ${v.trim()}`;
        if (v.toLowerCase() === "true" || v.toLowerCase() === "false")
          return `${k} = ${v.toLowerCase()}`;
        return `${k} = '${v.replace(/'/g, "''")}'`;
      })
      .join(", ");
    return {
      status: "success",
      data: `Generated SQL: UPDATE ${input.table} SET ${setClauses} WHERE id = 1`,
      renderData: {
        intent: input.intent,
        table: input.table,
        values,
      },
    };
  },
  render({ props, resolve }) {
    const { intent, table, columns } = props;
    return (
      <FormRenderer
        intent={intent}
        table={table}
        columns={columns}
        onSubmit={(values) => resolve(values)}
      />
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(renderResultSchema, data);
    if (!parsed) return null;

    const entries = Object.entries(parsed.values);
    return (
      <div
        style={{
          background: CREAM[50],
          border: `1px solid ${SAGE[100]}`,
          padding: 16,
          marginTop: 8,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 13,
            fontWeight: 600,
            color: SAGE[800],
            marginBottom: 8,
          }}
        >
          {parsed.intent === "insert" ? "Insert values" : "Update values"} for {parsed.table}
        </div>
        {entries.length === 0 ? (
          <div style={{ fontFamily: FONTS.body, fontSize: 12, color: SAGE[500] }}>
            No values were submitted.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {entries.map(([key, value]) => (
              <div key={key} style={{ display: "flex", gap: 8 }}>
                <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[500], minWidth: 120 }}>
                  {key}
                </span>
                <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[800] }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
});
