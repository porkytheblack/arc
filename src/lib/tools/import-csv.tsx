import { z } from "zod";
import { defineTool } from "glove-react";
import { CsvImport } from "../../components/CsvImport";
import { ErrorDisplay } from "../../components/ErrorDisplay";
import { CREAM, FONTS, SAGE } from "../theme";
import { parseRenderData } from "./render-data";

const inputSchema = z.object({
  tableName: z
    .string()
    .default("imported_data")
    .describe("Table name to assign to the imported data"),
});

const queryResultSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.unknown())),
  row_count: z.number(),
  execution_time_ms: z.number(),
});

const resolveSchema = z.union([
  z.object({
    result: queryResultSchema,
    tableName: z.string(),
  }),
  z.object({
    cancelled: z.literal(true),
  }),
]);

const displayPropsSchema = inputSchema.extend({
  error: z.string().optional(),
});
const renderResultSchema = z.object({
  tableName: z.string(),
  cancelled: z.boolean().optional(),
  rowCount: z.number().optional(),
  columnCount: z.number().optional(),
  error: z.string().optional(),
});

export const importCsvTool = defineTool({
  name: "import_csv",
  description:
    "Show a CSV file import dialog to upload and parse CSV data as a queryable table.",
  inputSchema,
  displayPropsSchema,
  resolveSchema,
  async do(input, display) {
    try {
      const outcome = await display.pushAndWait({
        tableName: input.tableName,
      });
      if ("cancelled" in outcome) {
        return {
          status: "success",
          data: "CSV import was not completed.",
          renderData: { tableName: input.tableName, cancelled: true },
        };
      }
      return {
        status: "success",
        data: `CSV imported as table "${outcome.tableName}" with ${outcome.result.row_count} rows and ${outcome.result.columns.length} columns.`,
        renderData: {
          tableName: outcome.tableName,
          rowCount: outcome.result.row_count,
          columnCount: outcome.result.columns.length,
        },
      };
    } catch (e) {
      const errorMsg = typeof e === "string" ? e : (e as Error).message || "Import failed";
      return {
        status: "error",
        data: { tableName: input.tableName, error: errorMsg },
        message: errorMsg,
        renderData: { tableName: input.tableName, error: errorMsg },
      };
    }
  },
  render({ props, resolve }) {
    const input = props;

    if (input.error) {
      return <ErrorDisplay title="Import Error" message={input.error} style={{ marginTop: 8 }} />;
    }

    return (
      <div style={{ marginTop: 8 }}>
        <CsvImport
          onPreviewImported={(result, importedTableName) =>
            resolve({
              result,
              tableName: importedTableName || input.tableName,
            })
          }
        />
      </div>
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(renderResultSchema, data);
    if (!parsed) return null;

    if (parsed.error) {
      return <ErrorDisplay title="Import Error" message={parsed.error} style={{ marginTop: 8 }} />;
    }

    if (parsed.cancelled) {
      return (
        <div
          style={{
            marginTop: 8,
            background: CREAM[50],
            border: `1px solid ${SAGE[100]}`,
            padding: 12,
            fontFamily: FONTS.body,
            fontSize: 13,
            color: SAGE[500],
          }}
        >
          CSV import was cancelled.
        </div>
      );
    }

    return (
      <div
        style={{
          marginTop: 8,
          background: CREAM[50],
          border: `1px solid ${SAGE[100]}`,
          padding: 12,
        }}
      >
        <div style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[800], fontWeight: 600 }}>
          Imported table: {parsed.tableName}
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[500], marginTop: 4 }}>
          {parsed.rowCount ?? 0} rows, {parsed.columnCount ?? 0} columns
        </div>
      </div>
    );
  },
});
