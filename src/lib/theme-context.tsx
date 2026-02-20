import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { applyTheme, applyGridlines, type ThemeMode } from "./theme-manager";
import { getSetting, setSetting } from "./commands";

interface ThemeContextValue {
  themeId: string;
  mode: ThemeMode;
  gridlines: boolean;
  setThemeId: (id: string) => void;
  setMode: (mode: ThemeMode) => void;
  setGridlines: (on: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState("sage");
  const [mode, setMode] = useState<ThemeMode>("light");
  const [gridlines, setGridlines] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    Promise.all([
      getSetting("theme_id"),
      getSetting("theme_mode"),
      getSetting("theme_gridlines"),
    ]).then(([id, m, g]) => {
      const tid = id || "sage";
      const tmode = (m as ThemeMode) || "light";
      const tgrid = g === "true";
      setThemeId(tid);
      setMode(tmode);
      setGridlines(tgrid);
      applyTheme(tid, tmode);
      applyGridlines(tgrid);
      setLoaded(true);
    });
  }, []);

  // Apply theme whenever settings change
  useEffect(() => {
    if (!loaded) return;
    applyTheme(themeId, mode);
    applyGridlines(gridlines);
    setSetting("theme_id", themeId);
    setSetting("theme_mode", mode);
    setSetting("theme_gridlines", String(gridlines));
  }, [themeId, mode, gridlines, loaded]);

  // Listen for system theme changes when mode is "system"
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme(themeId, "system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeId, mode]);

  return (
    <ThemeContext.Provider value={{ themeId, mode, gridlines, setThemeId, setMode, setGridlines }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeSettings() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeSettings must be used within ThemeProvider");
  return ctx;
}
