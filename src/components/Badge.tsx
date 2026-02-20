import type { ReactNode } from "react";
import { SAGE, SEMANTIC, FONTS } from "../lib/theme";

type BadgeVariant = "default" | "success" | "warning" | "error";

interface BadgeColorSet {
  bg: string;
  text: string;
  border: string;
}

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  style?: React.CSSProperties;
}

export function Badge({ children, variant = "default", style }: BadgeProps) {
  const colors: Record<BadgeVariant, BadgeColorSet> = {
    default: { bg: SAGE[50], text: SAGE[500], border: SAGE[100] },
    success: { bg: "#e8f5e9", text: "#2e7d32", border: "#c8e6c9" },
    warning: { bg: "#fff8e1", text: "#f57f17", border: "#ffecb3" },
    error: { bg: "#fbe9e7", text: SEMANTIC.error, border: "#ffccbc" },
  };

  const c = colors[variant];

  return (
    <span
      style={{
        fontFamily: FONTS.mono,
        fontSize: 10,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: c.text,
        background: c.bg,
        padding: "2px 8px",
        border: `1px solid ${c.border}`,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
