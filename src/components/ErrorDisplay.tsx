import { SAGE, CREAM, FONTS, SEMANTIC } from "../lib/theme";
import { AlertTriangle } from "lucide-react";

export interface ErrorDisplayProps {
  title?: string;
  message: string;
  detail?: string;
  style?: React.CSSProperties;
}

export function ErrorDisplay({
  title = "Error",
  message,
  detail,
  style,
}: ErrorDisplayProps) {
  return (
    <div
      style={{
        background: CREAM[50],
        border: `1px solid ${SEMANTIC.error}33`,
        padding: 16,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            background: `${SEMANTIC.error}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={14} color={SEMANTIC.error} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              fontWeight: 600,
              color: SAGE[900],
              display: "block",
              marginBottom: 4,
            }}
          >
            {title}
          </span>
          <p
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              color: SAGE[700],
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            {message}
          </p>
          {detail && (
            <div
              style={{
                marginTop: 8,
                background: SAGE[950],
                padding: "8px 12px",
                overflow: "auto",
                maxHeight: 120,
              }}
            >
              <code
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  color: SAGE[200],
                  whiteSpace: "pre-wrap",
                }}
              >
                {detail}
              </code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
