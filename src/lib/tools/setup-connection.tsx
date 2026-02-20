import { useState } from "react";
import { z } from "zod";
import { defineTool } from "glove-react";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { SAGE, CREAM, FONTS } from "../theme";
import { parseRenderData } from "./render-data";

const DB_TYPES = ["PostgreSQL", "MySQL", "SQLite", "Redis"] as const;

const DEFAULT_PORTS: Record<string, string> = {
  PostgreSQL: "5432",
  MySQL: "3306",
  SQLite: "0",
  Redis: "6379",
};

interface WizardProps {
  onComplete: (config: ConnectionConfig) => void;
  onCancel: () => void;
}

function ConnectionWizard({ onComplete, onCancel }: WizardProps) {
  const [step, setStep] = useState(1);
  const [dbType, setDbType] = useState("");
  const [name, setName] = useState("");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleTypeSelect = (type: string) => {
    setDbType(type);
    setPort(DEFAULT_PORTS[type] || "5432");
    setStep(2);
  };

  const handleSave = () => {
    onComplete({
      name: name.trim() || `${dbType} Connection`,
      dbType,
      host,
      port: parseInt(port, 10) || 0,
      database,
      username,
      password,
    });
  };

  return (
    <div
      style={{
        background: CREAM[50],
        border: `1px solid ${SAGE[100]}`,
        padding: 20,
        marginTop: 8,
      }}
    >
      {/* Step indicator */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          marginBottom: 20,
        }}
      >
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            style={{
              width: 6,
              height: 6,
              borderRadius: 6,
              background: s <= step ? SAGE[900] : SAGE[200],
              transition: "background 0.2s ease",
            }}
          />
        ))}
      </div>

      {/* Step 1: Choose DB type */}
      {step === 1 && (
        <div>
          <h3
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              fontWeight: 600,
              color: SAGE[900],
              margin: "0 0 16px",
            }}
          >
            Choose Database Type
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {DB_TYPES.map((type) => (
              <div
                key={type}
                onClick={() => handleTypeSelect(type)}
                style={{
                  padding: "16px 12px",
                  border: `1px solid ${SAGE[100]}`,
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s ease",
                  background: "transparent",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = SAGE[900];
                  (e.currentTarget as HTMLElement).style.background = SAGE[50];
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = SAGE[100];
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <div
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 14,
                    fontWeight: 500,
                    color: SAGE[900],
                  }}
                >
                  {type}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Connection details */}
      {step === 2 && (
        <div>
          <h3
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              fontWeight: 600,
              color: SAGE[900],
              margin: "0 0 16px",
            }}
          >
            Connection Details
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {dbType === "SQLite" ? (
              <Input
                label="File Path"
                value={database}
                onChange={setDatabase}
                placeholder="/path/to/database.db"
              />
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                  <Input label="Host" value={host} onChange={setHost} placeholder="localhost" />
                  <Input label="Port" value={port} onChange={setPort} placeholder={DEFAULT_PORTS[dbType]} />
                </div>
                {dbType !== "Redis" && (
                  <Input
                    label="Database"
                    value={database}
                    onChange={setDatabase}
                    placeholder="my_database"
                  />
                )}
                {dbType !== "Redis" && (
                  <Input
                    label="Username"
                    value={username}
                    onChange={setUsername}
                    placeholder="postgres"
                  />
                )}
                <Input
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter password"
                />
              </>
            )}
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button size="sm" variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button size="sm" onClick={() => setStep(3)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Name & save */}
      {step === 3 && (
        <div>
          <h3
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              fontWeight: 600,
              color: SAGE[900],
              margin: "0 0 16px",
            }}
          >
            Name Your Connection
          </h3>
          <Input
            label="Connection Name"
            value={name}
            onChange={setName}
            placeholder={`My ${dbType}`}
          />
          <div
            style={{
              marginTop: 12,
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: SAGE[400],
            }}
          >
            {dbType} {dbType === "SQLite" ? `\u2014 ${database || "(no path)"}` : `\u2014 ${host}:${port}`}
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button size="sm" variant="secondary" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save Connection
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputSchema = z.object({
  existingConnections: z
    .array(z.string())
    .optional()
    .describe("Names of existing connections to avoid duplicates"),
});

const connectionConfigSchema = z.object({
  name: z.string(),
  dbType: z.string(),
  host: z.string(),
  port: z.number(),
  database: z.string(),
  username: z.string(),
  password: z.string(),
});

type ConnectionConfig = z.infer<typeof connectionConfigSchema>;

const resolveSchema = z.union([
  connectionConfigSchema,
  z.object({
    cancelled: z.literal(true),
  }),
]);
const renderResultSchema = resolveSchema;

export const setupConnectionTool = defineTool({
  name: "setup_connection",
  description:
    "Show a multi-step wizard to set up a new database connection.",
  inputSchema,
  displayPropsSchema: inputSchema,
  resolveSchema,
  async do(input, display) {
    const config = await display.pushAndWait({
      existingConnections: input.existingConnections,
    });
    if ("cancelled" in config) {
      return {
        status: "success",
        data: "User cancelled the connection setup.",
        renderData: { cancelled: true },
      };
    }
    return {
      status: "success",
      data: `Connection configured: ${config.name} (${config.dbType}) at ${config.host}:${config.port}`,
      renderData: config,
    };
  },
  render({ props, resolve }) {
    void props;
    return (
      <ConnectionWizard
        onComplete={(config) => resolve(config)}
        onCancel={() => resolve({ cancelled: true })}
      />
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(renderResultSchema, data);
    if (!parsed) return null;

    if ("cancelled" in parsed) {
      return (
        <div
          style={{
            background: CREAM[50],
            border: `1px solid ${SAGE[100]}`,
            padding: 12,
            marginTop: 8,
            fontFamily: FONTS.body,
            fontSize: 13,
            color: SAGE[500],
          }}
        >
          Connection setup was cancelled.
        </div>
      );
    }

    return (
      <div
        style={{
          background: CREAM[50],
          border: `1px solid ${SAGE[100]}`,
          padding: 12,
          marginTop: 8,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 13,
            fontWeight: 600,
            color: SAGE[800],
            marginBottom: 6,
          }}
        >
          Connection configured: {parsed.name}
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 11,
            color: SAGE[600],
          }}
        >
          {parsed.dbType} \u2014 {parsed.host}:{parsed.port}
        </div>
      </div>
    );
  },
});
