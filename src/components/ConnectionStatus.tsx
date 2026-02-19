import { SAGE, CREAM, FONTS, SEMANTIC } from "../lib/theme";

export interface ConnectionStatusProps {
  name: string;
  dbType: string;
  host: string;
  connected: boolean;
  style?: React.CSSProperties;
}

export function ConnectionStatus({
  name,
  dbType,
  host,
  connected,
  style,
}: ConnectionStatusProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        background: CREAM[50],
        border: `1px solid ${SAGE[100]}`,
        ...style,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: connected ? SEMANTIC.success : SAGE[300],
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: 13,
            fontWeight: 500,
            color: SAGE[800],
            display: "block",
          }}
        >
          {name}
        </span>
        <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 10,
              color: SAGE[400],
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {dbType}
          </span>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 10,
              color: SAGE[300],
            }}
          >
            {host}
          </span>
        </div>
      </div>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: connected ? SEMANTIC.success : SAGE[400],
        }}
      >
        {connected ? "Connected" : "Disconnected"}
      </span>
    </div>
  );
}
