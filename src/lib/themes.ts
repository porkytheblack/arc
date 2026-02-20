export interface ThemeColors {
  primary: {
    50: string; 100: string; 200: string; 300: string; 400: string;
    500: string; 600: string; 700: string; 800: string; 900: string; 950: string;
  };
  bg: {
    50: string; 100: string; 200: string; 300: string;
  };
  semantic: {
    success: string; warning: string; error: string;
  };
}

export interface ThemeDefinition {
  id: string;
  name: string;
  light: ThemeColors;
  dark: ThemeColors;
}

export const themes: ThemeDefinition[] = [
  {
    id: "sage",
    name: "Sage",
    light: {
      primary: {
        50: "#f0f4f0", 100: "#dce5dc", 200: "#b8cab8", 300: "#8fa88f",
        400: "#6b8a6b", 500: "#4a6b4a", 600: "#3d5a3d", 700: "#2d422d",
        800: "#1e2e1e", 900: "#111a11", 950: "#0a100a",
      },
      bg: { 50: "#fefdfb", 100: "#faf7f2", 200: "#f2ebe0", 300: "#e8dcc8" },
      semantic: { success: "#4ade80", warning: "#d4a853", error: "#c45c5c" },
    },
    dark: {
      primary: {
        50: "#0d150d", 100: "#152115", 200: "#1e3220", 300: "#2d4a30",
        400: "#3d6340", 500: "#5a8a5a", 600: "#78a878", 700: "#9cc49c",
        800: "#c0dcc0", 900: "#e0f0e0", 950: "#f0f8f0",
      },
      bg: { 50: "#111a11", 100: "#161e16", 200: "#1e281e", 300: "#263226" },
      semantic: { success: "#4ade80", warning: "#e0b860", error: "#e06060" },
    },
  },
  {
    id: "gruvbox",
    name: "Gruvbox",
    light: {
      primary: {
        50: "#f2e5bc", 100: "#e0d0a0", 200: "#c9b47a", 300: "#b09860",
        400: "#98841c", 500: "#79740e", 600: "#665c00", 700: "#504510",
        800: "#3c3836", 900: "#282828", 950: "#1d2021",
      },
      bg: { 50: "#fbf1c7", 100: "#f2e5bc", 200: "#ebdbb2", 300: "#d5c4a1" },
      semantic: { success: "#98971a", warning: "#d79921", error: "#cc241d" },
    },
    dark: {
      primary: {
        50: "#1d2021", 100: "#282828", 200: "#3c3836", 300: "#504945",
        400: "#665c54", 500: "#928374", 600: "#a89984", 700: "#bdae93",
        800: "#d5c4a1", 900: "#ebdbb2", 950: "#fbf1c7",
      },
      bg: { 50: "#282828", 100: "#1d2021", 200: "#32302f", 300: "#3c3836" },
      semantic: { success: "#b8bb26", warning: "#fabd2f", error: "#fb4934" },
    },
  },
  {
    id: "tokyo",
    name: "Tokyo Night",
    light: {
      primary: {
        50: "#e8ecf4", 100: "#d5dce8", 200: "#b4bfda", 300: "#8c99b6",
        400: "#6172a0", 500: "#3760bf", 600: "#2e5aae", 700: "#1a3a6e",
        800: "#1a2035", 900: "#171b26", 950: "#0f1119",
      },
      bg: { 50: "#e1e2e7", 100: "#d5d6db", 200: "#c4c5ca", 300: "#b4b5ba" },
      semantic: { success: "#387068", warning: "#8f5e15", error: "#8c4351" },
    },
    dark: {
      primary: {
        50: "#1a1b26", 100: "#1e2030", 200: "#292e42", 300: "#343b58",
        400: "#444b6a", 500: "#565f89", 600: "#737aa2", 700: "#9aa5ce",
        800: "#a9b1d6", 900: "#c0caf5", 950: "#e0e4ff",
      },
      bg: { 50: "#1a1b26", 100: "#16161e", 200: "#24283b", 300: "#292e42" },
      semantic: { success: "#9ece6a", warning: "#e0af68", error: "#f7768e" },
    },
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    light: {
      primary: {
        50: "#eff1f5", 100: "#e6e9ef", 200: "#ccd0da", 300: "#bcc0cc",
        400: "#9ca0b0", 500: "#7c7f93", 600: "#6c6f85", 700: "#5c5f77",
        800: "#4c4f69", 900: "#303446", 950: "#232634",
      },
      bg: { 50: "#eff1f5", 100: "#e6e9ef", 200: "#dce0e8", 300: "#ccd0da" },
      semantic: { success: "#40a02b", warning: "#df8e1d", error: "#d20f39" },
    },
    dark: {
      primary: {
        50: "#11111b", 100: "#181825", 200: "#1e1e2e", 300: "#313244",
        400: "#45475a", 500: "#585b70", 600: "#6c7086", 700: "#a6adc8",
        800: "#bac2de", 900: "#cdd6f4", 950: "#eef0fc",
      },
      bg: { 50: "#1e1e2e", 100: "#181825", 200: "#313244", 300: "#45475a" },
      semantic: { success: "#a6e3a1", warning: "#f9e2af", error: "#f38ba8" },
    },
  },
];
