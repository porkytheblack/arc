// Arc Design Tokens
// Extracted from arc-brand-guidelines.md and glove-coffee.jsx

import type React from "react";

interface ColorScale {
  readonly 50: string;
  readonly 100: string;
  readonly 200: string;
  readonly 300: string;
  readonly 400: string;
  readonly 500: string;
  readonly 600: string;
  readonly 700: string;
  readonly 800: string;
  readonly 900: string;
  readonly 950: string;
}

interface CreamScale {
  readonly 50: string;
  readonly 100: string;
  readonly 200: string;
  readonly 300: string;
}

interface SemanticColors {
  readonly success: string;
  readonly warning: string;
  readonly error: string;
}

interface FontFamilies {
  readonly display: string;
  readonly body: string;
  readonly mono: string;
}

interface SpacingScale {
  readonly xs: number;
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
  readonly xl: number;
  readonly xxl: number;
}

interface Mixins {
  readonly label: React.CSSProperties;
  readonly metadata: React.CSSProperties;
  readonly bodyText: React.CSSProperties;
  readonly sectionHeader: React.CSSProperties;
  readonly pageTitle: React.CSSProperties;
  readonly dataText: React.CSSProperties;
  readonly card: React.CSSProperties;
  readonly input: React.CSSProperties;
}

export const SAGE: ColorScale = {
  50: "#f0f4f0",
  100: "#dce5dc",
  200: "#b8cab8",
  300: "#8fa88f",
  400: "#6b8a6b",
  500: "#4a6b4a",
  600: "#3d5a3d",
  700: "#2d422d",
  800: "#1e2e1e",
  900: "#111a11",
  950: "#0a100a",
};

export const CREAM: CreamScale = {
  50: "#fefdfb",
  100: "#faf7f2",
  200: "#f2ebe0",
  300: "#e8dcc8",
};

export const SEMANTIC: SemanticColors = {
  success: "#4ade80",
  warning: "#d4a853",
  error: "#c45c5c",
};

export const FONTS: FontFamilies = {
  display: "'Instrument Serif', Georgia, serif",
  body: "'DM Sans', sans-serif",
  mono: "'DM Mono', monospace",
};

export const SPACING: SpacingScale = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// Common style mixins
export const mixins: Mixins = {
  label: {
    fontFamily: FONTS.body,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: SAGE[500],
  },
  metadata: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: SAGE[300],
  },
  bodyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    fontWeight: 400,
    color: SAGE[800],
    lineHeight: 1.7,
  },
  sectionHeader: {
    fontFamily: FONTS.body,
    fontSize: 14,
    fontWeight: 600,
    color: SAGE[900],
  },
  pageTitle: {
    fontFamily: FONTS.display,
    fontSize: 28,
    fontWeight: 400,
    color: SAGE[900],
    margin: 0,
  },
  dataText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: 400,
    color: SAGE[700],
  },
  card: {
    background: CREAM[50],
    border: `1px solid ${SAGE[100]}`,
    padding: 24,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: `1px solid ${SAGE[200]}`,
    background: CREAM[50],
    fontFamily: FONTS.body,
    fontSize: 14,
    color: SAGE[900],
    outline: "none",
    boxSizing: "border-box",
  },
};
