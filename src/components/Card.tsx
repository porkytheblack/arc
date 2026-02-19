import type { ReactNode } from "react";
import { SAGE, CREAM } from "../lib/theme";

export interface CardProps {
  children: ReactNode;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export function Card({ children, style, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: CREAM[50],
        border: `1px solid ${SAGE[100]}`,
        padding: 24,
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.2s ease",
        ...style,
      }}
      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
        if (onClick) e.currentTarget.style.borderColor = SAGE[300];
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
        if (onClick) e.currentTarget.style.borderColor = SAGE[100];
      }}
    >
      {children}
    </div>
  );
}
