import type { ReactNode } from "react";
import { SAGE, FONTS } from "../lib/theme";

export interface TagProps {
  children: ReactNode;
  color?: string;
  style?: React.CSSProperties;
}

export function Tag({ children, color, style }: TagProps) {
  return (
    <span
      style={{
        fontFamily: FONTS.body,
        fontSize: 10,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: color || SAGE[500],
        background: SAGE[50],
        padding: "3px 8px",
        border: `1px solid ${SAGE[100]}`,
        display: "inline-block",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
