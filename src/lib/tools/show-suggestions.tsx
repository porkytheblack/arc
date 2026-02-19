import { useState } from "react";
import { z } from "zod";
import { defineTool } from "glove-react";
import { SAGE, FONTS } from "../theme";
import { useSendMessage } from "../send-message-context";
import { parseRenderData } from "./render-data";

function SuggestionChip({ label, message }: { label: string; message: string }) {
  const sendMessage = useSendMessage();
  const [clicked, setClicked] = useState(false);

  return (
    <button
      disabled={clicked || !sendMessage}
      onClick={() => {
        if (!sendMessage || clicked) return;
        setClicked(true);
        sendMessage(message);
      }}
      style={{
        background: clicked ? SAGE[50] : "transparent",
        border: `1px solid ${clicked ? SAGE[100] : SAGE[200]}`,
        padding: "6px 14px",
        fontFamily: FONTS.body,
        fontSize: 12,
        color: clicked ? SAGE[300] : SAGE[600],
        cursor: clicked ? "default" : "pointer",
        transition: "background 0.15s ease",
        opacity: clicked ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!clicked) {
          (e.target as HTMLElement).style.background = SAGE[50];
          (e.target as HTMLElement).style.borderColor = SAGE[300];
        }
      }}
      onMouseLeave={(e) => {
        if (!clicked) {
          (e.target as HTMLElement).style.background = "transparent";
          (e.target as HTMLElement).style.borderColor = SAGE[200];
        }
      }}
    >
      {label}
    </button>
  );
}

const inputSchema = z.object({
  suggestions: z
    .array(
      z.object({
        label: z.string().describe("Short button label"),
        message: z.string().describe("Message to send when clicked"),
      })
    )
    .max(4)
    .describe("Up to 4 suggested actions"),
});

export const showSuggestionsTool = defineTool({
  name: "show_suggestions",
  description:
    "Show suggested follow-up actions as clickable chips after completing an operation.",
  inputSchema,
  displayPropsSchema: inputSchema,
  resolveSchema: z.void(),
  async do(input, display) {
    await display.pushAndForget({ suggestions: input.suggestions });
    return {
      status: "success",
      data: `Suggested ${input.suggestions.length} follow-up actions.`,
      renderData: { suggestions: input.suggestions },
    };
  },
  render({ props }) {
    const { suggestions } = props;
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 8,
          padding: "8px 0",
        }}
      >
        {suggestions.map((s) => (
          <SuggestionChip key={s.label} label={s.label} message={s.message} />
        ))}
      </div>
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(inputSchema, data);
    if (!parsed) return null;
    const { suggestions } = parsed;

    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 8,
          padding: "8px 0",
        }}
      >
        {suggestions.map((s) => (
          <SuggestionChip key={s.label} label={s.label} message={s.message} />
        ))}
      </div>
    );
  },
});
