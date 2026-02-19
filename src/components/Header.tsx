import type { ReactNode } from "react";
import { SAGE, CREAM, FONTS, SEMANTIC } from "../lib/theme";

export interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 24px",
        borderBottom: `1px solid ${SAGE[100]}`,
        background: CREAM[50],
        flexShrink: 0,
      }}
    >
      <div>
        <h1
          style={{
            fontFamily: FONTS.display,
            fontSize: 22,
            fontWeight: 400,
            color: SAGE[900],
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: SAGE[400],
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {actions}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            border: `1px solid ${SAGE[100]}`,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              background: SEMANTIC.success,
              borderRadius: "50%",
            }}
          />
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 11,
              color: SAGE[500],
            }}
          >
            Ready
          </span>
        </div>
      </div>
    </div>
  );
}
