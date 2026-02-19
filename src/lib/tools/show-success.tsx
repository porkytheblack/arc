import { z } from "zod";
import { defineTool } from "glove-react";
import { SAGE, CREAM, FONTS } from "../theme";
import { Check } from "lucide-react";
import { parseRenderData } from "./render-data";

const inputSchema = z.object({
  message: z.string().describe("The success message"),
  detail: z.string().optional().describe("Optional detail text"),
});

export const showSuccessTool = defineTool({
  name: "show_success",
  description:
    "Show a lightweight inline success notification after completing an action.",
  inputSchema,
  displayPropsSchema: inputSchema,
  resolveSchema: z.void(),
  async do(input, display) {
    await display.pushAndForget({ message: input.message, detail: input.detail });
    return {
      status: "success",
      data: `Success: ${input.message}`,
      renderData: { message: input.message, detail: input.detail },
    };
  },
  render({ props }) {
    const { message, detail } = props;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: CREAM[50],
          border: `1px solid rgba(76, 175, 80, 0.2)`,
          padding: "10px 16px",
          marginTop: 8,
        }}
      >
        <Check size={14} color="#4caf50" />
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: 13,
            color: SAGE[800],
          }}
        >
          {message}
        </span>
        {detail && (
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: SAGE[400],
              marginLeft: "auto",
            }}
          >
            {detail}
          </span>
        )}
      </div>
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(inputSchema, data);
    if (!parsed) return null;
    const { message, detail } = parsed;

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: CREAM[50],
          border: `1px solid rgba(76, 175, 80, 0.2)`,
          padding: "10px 16px",
          marginTop: 8,
        }}
      >
        <Check size={14} color="#4caf50" />
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: 13,
            color: SAGE[800],
          }}
        >
          {message}
        </span>
        {detail && (
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: SAGE[400],
              marginLeft: "auto",
            }}
          >
            {detail}
          </span>
        )}
      </div>
    );
  },
});
