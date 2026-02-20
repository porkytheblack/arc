import { z } from "zod";
import { defineTool } from "glove-react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { CREAM, FONTS, SAGE } from "../theme";
import { parseRenderData } from "./render-data";

const inputSchema = z.object({
  sql: z.string().describe("The destructive SQL query to confirm"),
  description: z
    .string()
    .default("This action will modify data in your database.")
    .describe("Human-readable description of what this action does"),
});

const resolveSchema = z.object({
  confirmed: z.boolean(),
});

const renderResultSchema = inputSchema.extend({
  confirmed: z.boolean(),
});

export const confirmActionTool = defineTool({
  name: "confirm_action",
  description:
    "Show a confirmation dialog before executing a destructive operation.",
  inputSchema,
  displayPropsSchema: inputSchema,
  resolveSchema,
  async do(input, display) {
    const outcome = await display.pushAndWait({
      sql: input.sql,
      description: input.description,
    });
    if (outcome.confirmed) {
      return {
        status: "success",
        data: `User confirmed the action. Proceeding with: ${input.sql}`,
        renderData: { sql: input.sql, description: input.description, confirmed: true },
      };
    }
    return {
      status: "success",
      data: "User cancelled the operation. No changes were made.",
      renderData: { sql: input.sql, description: input.description, confirmed: false },
    };
  },
  render({ props, resolve }) {
    const { sql, description } = props;
    return (
      <ConfirmDialog
        title="Destructive Query Detected"
        description={description}
        sql={sql}
        onConfirm={() => resolve({ confirmed: true })}
        onCancel={() => resolve({ confirmed: false })}
      />
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(renderResultSchema, data);
    if (!parsed) return null;

    return (
      <div
        style={{
          marginTop: 8,
          background: CREAM[50],
          border: `1px solid ${SAGE[100]}`,
          padding: 12,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 13,
            fontWeight: 600,
            color: parsed.confirmed ? SAGE[800] : SAGE[500],
            marginBottom: 6,
          }}
        >
          {parsed.confirmed ? "Action confirmed" : "Action cancelled"}
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 12,
            color: SAGE[600],
            marginBottom: 6,
          }}
        >
          {parsed.description}
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 11,
            color: SAGE[500],
            whiteSpace: "pre-wrap",
          }}
        >
          {parsed.sql}
        </div>
      </div>
    );
  },
});
