import { SAGE, CREAM, FONTS } from "../lib/theme";

export interface LoadingStateProps {
  message?: string;
  style?: React.CSSProperties;
}

export function LoadingState({
  message = "Loading...",
  style,
}: LoadingStateProps) {
  return (
    <div
      style={{
        padding: 24,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        background: CREAM[50],
        border: `1px solid ${SAGE[100]}`,
        ...style,
      }}
    >
      <div style={{ display: "flex", gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              background: SAGE[300],
              borderRadius: "50%",
              animation: `typingDot 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontFamily: FONTS.body,
          fontSize: 12,
          color: SAGE[400],
        }}
      >
        {message}
      </span>
    </div>
  );
}
