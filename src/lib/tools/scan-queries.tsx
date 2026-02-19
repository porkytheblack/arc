import { z } from "zod";
import { defineTool } from "glove-react";
import { scanQueries } from "../commands";
import { ErrorDisplay } from "../../components/ErrorDisplay";
import { SAGE, CREAM, FONTS } from "../theme";
import { Badge } from "../../components/Badge";
import { parseRenderData } from "./render-data";

const inputSchema = z.object({
  directoryPath: z
    .string()
    .default(".")
    .describe("Directory path to scan for SQL queries"),
});

const scanResultSchema = z.object({
  file_path: z.string(),
  line_number: z.number(),
  query_snippet: z.string(),
  query_type: z.string(),
});

const displayPropsSchema = z.object({
  results: z.array(scanResultSchema),
  directoryPath: z.string(),
  error: z.string().nullable(),
});

export const scanQueriesTool = defineTool({
  name: "scan_queries",
  description:
    "Scan a directory for embedded SQL queries in source code files.",
  inputSchema,
  displayPropsSchema,
  resolveSchema: z.void(),
  async do(input, display) {
    try {
      const results = await scanQueries(input.directoryPath);
      await display.pushAndForget({ results, directoryPath: input.directoryPath, error: null });
      return {
        status: "success",
        data: `Found ${results.length} SQL queries in ${input.directoryPath}.`,
        renderData: { results, directoryPath: input.directoryPath, error: null },
      };
    } catch (e) {
      const errorMsg = typeof e === "string" ? e : (e as Error).message || "Scan failed";
      await display.pushAndForget({ results: [], directoryPath: input.directoryPath, error: errorMsg });
      return {
        status: "error",
        data: { directoryPath: input.directoryPath, error: errorMsg },
        message: errorMsg,
        renderData: { results: [], directoryPath: input.directoryPath, error: errorMsg },
      };
    }
  },
  render({ props }) {
    const { results, error } = props;

    if (error) {
      return <ErrorDisplay title="Scan Error" message={error} style={{ marginTop: 8 }} />;
    }

    if (results.length === 0) {
      return (
        <div
          style={{
            marginTop: 8,
            padding: 16,
            background: CREAM[50],
            border: `1px solid ${SAGE[100]}`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              color: SAGE[500],
            }}
          >
            No SQL queries found in the scanned directory.
          </span>
        </div>
      );
    }

    const displayed = results.slice(0, 20);

    return (
      <div
        style={{
          marginTop: 8,
          background: CREAM[50],
          border: `1px solid ${SAGE[100]}`,
          overflow: "hidden",
        }}
      >
        {displayed.map((result, idx) => (
          <div
            key={`${result.file_path}:${result.line_number}`}
            style={{
              padding: "10px 16px",
              borderBottom:
                idx < displayed.length - 1
                  ? `1px solid ${SAGE[50]}`
                  : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  color: SAGE[600],
                }}
              >
                {result.file_path}:{result.line_number}
              </span>
              <Badge>{result.query_type}</Badge>
            </div>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: SAGE[500],
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {result.query_snippet}
            </div>
          </div>
        ))}
        {results.length > 20 && (
          <div
            style={{
              padding: "8px 16px",
              background: SAGE[50],
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 10,
                color: SAGE[400],
              }}
            >
              Showing 20 of {results.length} results
            </span>
          </div>
        )}
      </div>
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(displayPropsSchema, data);
    if (!parsed) return null;
    const { results, error } = parsed;

    if (error) {
      return <ErrorDisplay title="Scan Error" message={error} style={{ marginTop: 8 }} />;
    }

    if (results.length === 0) {
      return (
        <div
          style={{
            marginTop: 8,
            padding: 16,
            background: CREAM[50],
            border: `1px solid ${SAGE[100]}`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              color: SAGE[500],
            }}
          >
            No SQL queries found in the scanned directory.
          </span>
        </div>
      );
    }

    const displayed = results.slice(0, 20);

    return (
      <div
        style={{
          marginTop: 8,
          background: CREAM[50],
          border: `1px solid ${SAGE[100]}`,
          overflow: "hidden",
        }}
      >
        {displayed.map((result, idx) => (
          <div
            key={`${result.file_path}:${result.line_number}`}
            style={{
              padding: "10px 16px",
              borderBottom:
                idx < displayed.length - 1
                  ? `1px solid ${SAGE[50]}`
                  : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  color: SAGE[600],
                }}
              >
                {result.file_path}:{result.line_number}
              </span>
              <Badge>{result.query_type}</Badge>
            </div>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: SAGE[500],
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {result.query_snippet}
            </div>
          </div>
        ))}
        {results.length > 20 && (
          <div
            style={{
              padding: "8px 16px",
              background: SAGE[50],
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 10,
                color: SAGE[400],
              }}
            >
              Showing 20 of {results.length} results
            </span>
          </div>
        )}
      </div>
    );
  },
});
