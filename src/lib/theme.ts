// Arc Design Tokens
// Colors resolve via CSS custom properties set by theme-manager.ts

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
  50: "var(--primary-50)",
  100: "var(--primary-100)",
  200: "var(--primary-200)",
  300: "var(--primary-300)",
  400: "var(--primary-400)",
  500: "var(--primary-500)",
  600: "var(--primary-600)",
  700: "var(--primary-700)",
  800: "var(--primary-800)",
  900: "var(--primary-900)",
  950: "var(--primary-950)",
};

export const CREAM: CreamScale = {
  50: "var(--bg-50)",
  100: "var(--bg-100)",
  200: "var(--bg-200)",
  300: "var(--bg-300)",
};

export const SEMANTIC: SemanticColors = {
  success: "var(--semantic-success)",
  warning: "var(--semantic-warning)",
  error: "var(--semantic-error)",
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
