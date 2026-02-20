import { useState, type ReactNode } from "react";
import { SAGE, CREAM, FONTS } from "../lib/theme";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  style?: React.CSSProperties;
  disabled?: boolean;
  size?: ButtonSize;
}

export function Button({ children, variant = "primary", onClick, style, disabled, size = "md" }: ButtonProps) {
  const [hovered, setHovered] = useState(false);

  const sizes: Record<ButtonSize, React.CSSProperties> = {
    sm: { padding: "6px 12px", fontSize: 11 },
    md: { padding: "10px 16px", fontSize: 12 },
    lg: { padding: "14px 24px", fontSize: 14 },
  };

  const variants: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: hovered ? SAGE[700] : SAGE[900],
      color: CREAM[50],
      border: "none",
    },
    secondary: {
      background: hovered ? SAGE[900] : "transparent",
      color: hovered ? CREAM[50] : SAGE[700],
      border: `1px solid ${hovered ? SAGE[900] : SAGE[200]}`,
    },
    ghost: {
      background: hovered ? SAGE[50] : "transparent",
      color: SAGE[700],
      border: "none",
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...sizes[size],
        ...variants[variant],
        fontFamily: FONTS.body,
        fontWeight: 500,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.2s ease",
        opacity: disabled ? 0.5 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
