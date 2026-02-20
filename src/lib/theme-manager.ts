import { themes, type ThemeColors } from "./themes";

export type ThemeMode = "light" | "dark" | "system";

function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export function applyTheme(themeId: string, mode: ThemeMode): void {
  const theme = themes.find((t) => t.id === themeId);
  if (!theme) return;

  const resolved = resolveMode(mode);
  const colors: ThemeColors = resolved === "dark" ? theme.dark : theme.light;
  const root = document.documentElement;

  for (const [stop, value] of Object.entries(colors.primary)) {
    root.style.setProperty(`--primary-${stop}`, value);
  }
  for (const [stop, value] of Object.entries(colors.bg)) {
    root.style.setProperty(`--bg-${stop}`, value);
  }
  root.style.setProperty("--semantic-success", colors.semantic.success);
  root.style.setProperty("--semantic-warning", colors.semantic.warning);
  root.style.setProperty("--semantic-error", colors.semantic.error);

  root.dataset.theme = themeId;
  root.dataset.mode = resolved;
}

export function applyGridlines(on: boolean): void {
  document.documentElement.dataset.gridlines = String(on);
}

// Apply default theme immediately to prevent FOUC
applyTheme("sage", "light");
