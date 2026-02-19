import { z } from "zod";
import { defineTool } from "glove-react";
import { SAGE, CREAM, FONTS } from "../theme";
import { parseRenderData } from "./render-data";

interface DisambiguateRendererProps {
  question: string;
  options: { value: string; label: string; description?: string }[];
  onSelect: (value: string) => void;
}

function DisambiguateRenderer({ question, options, onSelect }: DisambiguateRendererProps) {
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
          fontSize: 14,
          color: SAGE[800],
          margin: "0 0 12px",
        }}
      >
        {question}
      </p>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {options.map((opt) => (
          <div
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              padding: "10px 12px",
              cursor: "pointer",
              borderBottom: `1px solid ${SAGE[50]}`,
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = CREAM[100];
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: SAGE[300],
              }}
            >
              &gt;
            </span>
            <div>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 13,
                  color: SAGE[700],
                }}
              >
                {opt.label}
              </span>
              {opt.description && (
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 11,
                    color: SAGE[400],
                    marginLeft: 12,
                  }}
                >
                  {opt.description}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputSchema = z.object({
  question: z.string().describe("The disambiguation question"),
  options: z
    .array(
      z.object({
        value: z.string().describe("The option value to return"),
        label: z.string().describe("Display label"),
        description: z.string().optional().describe("Additional context"),
      })
    )
    .describe("The options to choose from"),
});

const resolveSchema = z.object({
  selected: z.string(),
});
const renderResultSchema = inputSchema.extend({
  selected: z.string(),
});

export const disambiguateTool = defineTool({
  name: "disambiguate",
  description:
    "Ask the user to choose between multiple options when a request is ambiguous.",
  inputSchema,
  displayPropsSchema: inputSchema,
  resolveSchema,
  async do(input, display) {
    const chosen = await display.pushAndWait({
      question: input.question,
      options: input.options,
    });
    return {
      status: "success",
      data: `User selected: ${chosen.selected}`,
      renderData: {
        question: input.question,
        options: input.options,
        selected: chosen.selected,
      },
    };
  },
  render({ props, resolve }) {
    const { question, options } = props;
    return (
      <DisambiguateRenderer
        question={question}
        options={options}
        onSelect={(value) => resolve({ selected: value })}
      />
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(renderResultSchema, data);
    if (!parsed) return null;
    const selected = parsed.options.find((opt) => opt.value === parsed.selected);

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
            fontSize: 14,
            color: SAGE[800],
            margin: "0 0 10px",
          }}
        >
          {parsed.question}
        </p>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 12,
            color: SAGE[700],
          }}
        >
          Selected: {selected?.label || parsed.selected}
        </div>
      </div>
    );
  },
});
