import { useState, useEffect } from "react";
import { SAGE, CREAM, FONTS } from "../lib/theme";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Select } from "../components/Select";
import { getSetting, setSetting } from "../lib/commands";
import { providers } from "../lib/adapters";
import { useThemeSettings } from "../lib/theme-context";
import { themes } from "../lib/themes";
import { Eye, EyeOff, Check } from "lucide-react";

type RowDisplay = "compact" | "comfortable";

interface SettingsSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <h3
          style={{
            fontFamily: FONTS.body,
            fontSize: 14,
            fontWeight: 600,
            color: SAGE[900],
            margin: 0,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontFamily: FONTS.body,
            fontSize: 12,
            color: SAGE[500],
            margin: "4px 0 0",
          }}
        >
          {description}
        </p>
      </div>
      {children}
    </Card>
  );
}

interface ToggleOptionProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string;
  onChange: (value: string) => void;
}

function ToggleOption({ label, options, selected, onChange }: ToggleOptionProps) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
      <span style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[800] }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: 0, border: `1px solid ${SAGE[200]}` }}>
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: "6px 14px",
              background: selected === opt.value ? SAGE[900] : "transparent",
              color: selected === opt.value ? CREAM[50] : SAGE[600],
              border: "none",
              fontFamily: FONTS.body,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ProviderConfig {
  label: string;
  placeholder: string;
  testUrl: string;
  testMethod: "GET" | "POST";
  testHeaders: (key: string) => Record<string, string>;
  testBody?: (model: string) => string;
  models: { value: string; label: string }[];
}

function modelLabel(id: string): string {
  const name = id.includes("/") ? id.split("/").pop()! : id;
  return name
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/(\d)/g, " $1")
    .replace(/\s+/g, " ")
    .trim();
}

const PROVIDERS: Record<string, ProviderConfig> = Object.fromEntries(
  Object.entries(providers).map(([id, p]) => {
    const base: ProviderConfig = {
      label: p.name,
      placeholder: "...",
      testUrl: `${p.baseURL.replace(/\/+$/, "")}/models`,
      testMethod: "GET",
      testHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
      models: p.models.map((m) => ({ value: m, label: modelLabel(m) })),
    };

    if (id === "openai") base.placeholder = "sk-...";
    if (id === "anthropic") {
      base.placeholder = "sk-ant-...";
      base.testUrl = "https://api.anthropic.com/v1/messages";
      base.testMethod = "POST";
      base.testHeaders = (key) => ({
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "anthropic-dangerous-direct-browser-access": "true",
      });
      base.testBody = (model) =>
        JSON.stringify({ model, max_tokens: 1, messages: [{ role: "user", content: "hi" }] });
    }
    if (id === "openrouter") base.placeholder = "sk-or-...";
    if (id === "gemini") base.placeholder = "AIza...";
    if (id === "minimax") base.placeholder = "eyJ...";
    if (id === "kimi") base.placeholder = "sk-...";

    return [id, base];
  })
);

function ThemeCard({
  theme,
  isSelected,
  isDark,
  onClick,
}: {
  theme: (typeof themes)[number];
  isSelected: boolean;
  isDark: boolean;
  onClick: () => void;
}) {
  const colors = isDark ? theme.dark : theme.light;
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 12,
        background: CREAM[50],
        border: `2px solid ${isSelected ? SAGE[500] : hovered ? SAGE[300] : SAGE[100]}`,
        cursor: "pointer",
        transition: "border-color 0.2s ease",
        position: "relative",
      }}
    >
      {/* Color swatch preview */}
      <div style={{ display: "flex", height: 32, overflow: "hidden" }}>
        <div style={{ flex: 1, background: colors.bg[50] }} />
        <div style={{ flex: 1, background: colors.bg[200] }} />
        <div style={{ flex: 1, background: colors.primary[500] }} />
        <div style={{ flex: 1, background: colors.primary[900] }} />
      </div>
      <span
        style={{
          fontFamily: FONTS.body,
          fontSize: 12,
          fontWeight: 500,
          color: SAGE[800],
          textAlign: "left",
        }}
      >
        {theme.name}
      </span>
      {isSelected && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 18,
            height: 18,
            background: SAGE[500],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
          }}
        >
          <Check size={10} color={CREAM[50]} strokeWidth={3} />
        </div>
      )}
    </button>
  );
}

export function Settings() {
  const { themeId, mode, gridlines, setThemeId, setMode, setGridlines } = useThemeSettings();

  const [rowDisplay, setRowDisplay] = useState<RowDisplay>("comfortable");
  const [maxRows, setMaxRows] = useState("100");
  const [defaultHost, setDefaultHost] = useState("localhost");
  const [defaultPort, setDefaultPort] = useState("5432");
  const [defaultDb, setDefaultDb] = useState("PostgreSQL");
  const [showLineNumbers, setShowLineNumbers] = useState("yes");

  // AI Provider state
  const [aiProvider, setAiProvider] = useState("openrouter");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("anthropic/claude-sonnet-4");
  const [showKey, setShowKey] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    Promise.all([
      getSetting("ai_provider"),
      getSetting("ai_api_key"),
      getSetting("ai_model"),
    ]).then(([provider, key, model]) => {
      if (provider) setAiProvider(provider);
      if (key) setAiApiKey(key);
      if (model) setAiModel(model);
    });
  }, []);

  const handleProviderChange = (provider: string) => {
    setAiProvider(provider);
    const config = PROVIDERS[provider];
    if (config && config.models.length > 0) {
      setAiModel(config.models[0].value);
    }
  };

  const handleSaveAi = async () => {
    setAiSaving(true);
    setAiFeedback(null);
    try {
      await setSetting("ai_provider", aiProvider);
      await setSetting("ai_api_key", aiApiKey);
      await setSetting("ai_model", aiModel);
      setAiFeedback({ type: "success", message: "Settings saved" });
      setTimeout(() => setAiFeedback(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiFeedback({ type: "error", message: `Failed to save: ${msg}` });
    }
    setAiSaving(false);
  };

  const handleTestKey = async () => {
    if (!aiApiKey.trim()) {
      setAiFeedback({ type: "error", message: "Enter an API key first" });
      return;
    }
    const config = PROVIDERS[aiProvider];
    if (!config) return;

    setAiTesting(true);
    setAiFeedback(null);
    try {
      const fetchOpts: RequestInit = {
        method: config.testMethod,
        headers: config.testHeaders(aiApiKey),
      };
      if (config.testBody) {
        fetchOpts.body = config.testBody(aiModel);
      }
      const res = await fetch(config.testUrl, fetchOpts);
      if (res.ok) {
        setAiFeedback({ type: "success", message: `${config.label} key is valid` });
      } else {
        const body = await res.text();
        setAiFeedback({ type: "error", message: `Invalid key: ${body.slice(0, 100)}` });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiFeedback({ type: "error", message: `Test failed: ${msg}` });
    }
    setAiTesting(false);
    setTimeout(() => setAiFeedback(null), 5000);
  };

  const isDarkPreview = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 32 }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <h1
            style={{
              fontFamily: FONTS.display,
              fontSize: 28,
              fontWeight: 400,
              color: SAGE[900],
              margin: 0,
            }}
          >
            Settings
          </h1>
          <p
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              color: SAGE[500],
              marginTop: 4,
            }}
          >
            Configure your Arc workspace
          </p>
        </div>

        {/* AI Provider */}
        <SettingsSection title="AI Provider" description="Configure the LLM that powers your explorations">
          <div style={{ padding: "10px 0" }}>
            <label style={{ fontFamily: FONTS.body, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: SAGE[500], display: "block", marginBottom: 6 }}>
              Provider
            </label>
            <Select
              value={aiProvider}
              onChange={handleProviderChange}
              options={Object.entries(PROVIDERS).map(([id, cfg]) => ({ value: id, label: cfg.label }))}
              minWidth={0}
              style={{
                width: "100%",
              }}
            />
          </div>
          <div style={{ padding: "10px 0" }}>
            <label style={{ fontFamily: FONTS.body, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: SAGE[500], display: "block", marginBottom: 6 }}>
              API Key
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  type={showKey ? "text" : "password"}
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder={PROVIDERS[aiProvider]?.placeholder || "..."}
                  style={{
                    width: "100%",
                    padding: "10px 36px 10px 12px",
                    border: `1px solid ${SAGE[200]}`,
                    background: CREAM[50],
                    fontFamily: FONTS.mono,
                    fontSize: 13,
                    color: SAGE[900],
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  {showKey ? <EyeOff size={14} color={SAGE[400]} /> : <Eye size={14} color={SAGE[400]} />}
                </button>
              </div>
            </div>
          </div>
          <div style={{ padding: "10px 0" }}>
            <label style={{ fontFamily: FONTS.body, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: SAGE[500], display: "block", marginBottom: 6 }}>
              Model
            </label>
            <Select
              value={aiModel}
              onChange={setAiModel}
              options={(PROVIDERS[aiProvider]?.models || []).map((m) => ({ value: m.value, label: m.label }))}
              placeholder="No models available"
              disabled={(PROVIDERS[aiProvider]?.models || []).length === 0}
              minWidth={0}
              style={{
                width: "100%",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, padding: "10px 0" }}>
            <Button size="sm" onClick={handleSaveAi} disabled={aiSaving}>
              {aiSaving ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="secondary" onClick={handleTestKey} disabled={aiTesting || !aiApiKey.trim()}>
              {aiTesting ? "Testing..." : "Test Key"}
            </Button>
          </div>
          {aiFeedback && (
            <div
              style={{
                padding: "8px 12px",
                fontFamily: FONTS.mono,
                fontSize: 12,
                color: aiFeedback.type === "success" ? "#3a7a3a" : "#c45c5c",
                background: aiFeedback.type === "success" ? "#f0f7f0" : "#fdf0f0",
                border: `1px solid ${aiFeedback.type === "success" ? "#c8e0c8" : "#f0d0d0"}`,
              }}
            >
              {aiFeedback.message}
            </div>
          )}
        </SettingsSection>

        {/* Appearance */}
        <SettingsSection title="Appearance" description="Customize the look and feel of Arc">
          {/* Theme picker */}
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontFamily: FONTS.body, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: SAGE[500], display: "block", marginBottom: 10 }}>
              Color Theme
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {themes.map((t) => (
                <ThemeCard
                  key={t.id}
                  theme={t}
                  isSelected={themeId === t.id}
                  isDark={isDarkPreview}
                  onClick={() => setThemeId(t.id)}
                />
              ))}
            </div>
          </div>
          <ToggleOption
            label="Mode"
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ]}
            selected={mode}
            onChange={(v) => setMode(v as "light" | "dark" | "system")}
          />
          <ToggleOption
            label="Background gridlines"
            options={[
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
            ]}
            selected={gridlines ? "on" : "off"}
            onChange={(v) => setGridlines(v === "on")}
          />
        </SettingsSection>

        {/* Data Display */}
        <SettingsSection title="Data Display" description="Control how query results are shown">
          <ToggleOption
            label="Row density"
            options={[
              { value: "compact", label: "Compact" },
              { value: "comfortable", label: "Comfortable" },
            ]}
            selected={rowDisplay}
            onChange={(v) => setRowDisplay(v as RowDisplay)}
          />
          <ToggleOption
            label="Line numbers in SQL"
            options={[
              { value: "yes", label: "Show" },
              { value: "no", label: "Hide" },
            ]}
            selected={showLineNumbers}
            onChange={setShowLineNumbers}
          />
          <div style={{ padding: "10px 0" }}>
            <Input
              label="Max rows to display"
              value={maxRows}
              onChange={setMaxRows}
              placeholder="100"
            />
          </div>
        </SettingsSection>

        {/* Connection Defaults */}
        <SettingsSection title="Connection Defaults" description="Default values for new database connections">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: SAGE[500],
                }}
              >
                Database Type
              </label>
              <Select
                value={defaultDb}
                onChange={setDefaultDb}
                options={["PostgreSQL", "MySQL", "SQLite", "MongoDB"].map((t) => ({ value: t, label: t }))}
                minWidth={0}
                style={{
                  width: "100%",
                }}
              />
            </div>
            <Input label="Default Host" value={defaultHost} onChange={setDefaultHost} placeholder="localhost" />
            <Input label="Default Port" value={defaultPort} onChange={setDefaultPort} placeholder="5432" />
          </div>
        </SettingsSection>

        {/* About */}
        <SettingsSection title="About" description="Arc version and information">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[600] }}>Version</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: SAGE[800] }}>0.1.0</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[600] }}>Engine</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: SAGE[800] }}>Tauri v2</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[600] }}>Platform</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: SAGE[800] }}>Glove</span>
            </div>
          </div>
        </SettingsSection>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 32,
            gap: 6,
            alignItems: "center",
          }}
        >
          <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: SAGE[300], letterSpacing: "0.1em" }}>
            POWERED BY
          </span>
          <span style={{ fontFamily: FONTS.display, fontSize: 12, color: SAGE[500] }}>
            Glove
          </span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: SAGE[300] }}>
            {"\u00B7"}
          </span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: SAGE[300], letterSpacing: "0.05em" }}>
            dterminal.net
          </span>
        </div>
      </div>
    </div>
  );
}
