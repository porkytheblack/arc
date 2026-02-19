import { useState, useEffect, useCallback, useRef } from "react";
import { SAGE, CREAM, FONTS } from "../lib/theme";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Input } from "../components/Input";
import {
  listConnections,
  addConnection,
  removeConnection,
  testConnection,
  connectDatabase,
  disconnectDatabase,
  getCachedSchema,
  getSchema,
  listProjectConnections,
  linkConnectionToProject,
  unlinkConnectionFromProject,
  autoConnectProjectConnections,
  listConnectionNotes,
  setConnectionNote,
} from "../lib/commands";
import type { DatabaseConnection, TableSchema, ConnectionNote } from "../lib/commands";
import { CsvImport } from "../components/CsvImport";
import { Database, Plus, X, RefreshCw, Trash2, ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

const AUTO_CONNECT_ATTEMPTED = new Set<string>();

interface ConnectionCardProps {
  conn: DatabaseConnection;
  note: string;
  onToggle: (id: string, password: string, useSsl: boolean) => Promise<string | null>;
  onRemove: (id: string) => void;
  onTest: (id: string) => Promise<string | null>;
  onSaveNote: (id: string, note: string) => Promise<string | null>;
  onUnlink?: (id: string) => void;
}

function ConnectionCard({ conn, note, onToggle, onRemove, onTest, onSaveNote, onUnlink }: ConnectionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [schema, setSchema] = useState<TableSchema[] | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [password, setPassword] = useState(conn.password || "");
  const [useSsl, setUseSsl] = useState(conn.use_ssl || false);
  const [noteDraft, setNoteDraft] = useState(note || "");
  const [savingNote, setSavingNote] = useState(false);
  const needsPassword = conn.db_type !== "SQLite" && conn.db_type !== "Redis";
  const showSsl = conn.db_type === "PostgreSQL" || conn.db_type === "MySQL";

  // Auto-introspect only when expanded to avoid background load on slow DBs.
  const introspectAttempted = useRef(false);
  useEffect(() => {
    let cancelled = false;
    setSchema(null);
    getCachedSchema(conn.id)
      .then((cached) => {
        if (cancelled || !cached || cached.length === 0) return;
        setSchema(cached);
        introspectAttempted.current = true;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conn.id]);

  useEffect(() => {
    if (expanded && conn.connected && !schema && !introspectAttempted.current) {
      introspectAttempted.current = true;
      setLoadingSchema(true);
      getSchema(conn.id)
        .then((s) => setSchema(s))
        .catch(() => {})
        .finally(() => setLoadingSchema(false));
    }
    // Reset the guard when disconnected so reconnecting will re-introspect
    if (!conn.connected) {
      introspectAttempted.current = false;
    }
  }, [expanded, conn.connected, conn.id, schema]);

  useEffect(() => {
    setNoteDraft(note || "");
  }, [note, conn.id]);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleIntrospect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!conn.connected) {
      showFeedback("error", "Connect to the database first before introspecting");
      return;
    }
    setLoadingSchema(true);
    try {
      const s = await getSchema(conn.id, true);
      setSchema(s);
      showFeedback("success", `Found ${s.length} table${s.length !== 1 ? "s" : ""}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback("error", `Introspection failed: ${msg}`);
    }
    setLoadingSchema(false);
  };

  return (
    <Card style={{ padding: 0 }}>
      <div
        style={{
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Database size={20} color={conn.connected ? SAGE[500] : SAGE[300]} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: FONTS.body, fontSize: 15, fontWeight: 500, color: SAGE[900] }}>
                {conn.name}
              </span>
              <Badge variant={conn.connected ? "success" : "default"}>
                {conn.connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[400] }}>
                {conn.db_type}
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[400] }}>
                {conn.db_type === "SQLite" ? conn.database : `${conn.host}:${conn.port}`}
              </span>
              {schema && (
                <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[400] }}>
                  {schema.length} tables
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {expanded ? (
            <ChevronDown size={16} color={SAGE[400]} />
          ) : (
            <ChevronRight size={16} color={SAGE[400]} />
          )}
        </div>
      </div>

      {expanded && (
        <div
          style={{
            padding: "0 20px 16px",
            borderTop: `1px solid ${SAGE[50]}`,
            paddingTop: 16,
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: conn.db_type === "SQLite" ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
            {conn.db_type === "SQLite" ? (
              <div>
                <span style={{ fontFamily: FONTS.body, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: SAGE[500], display: "block", marginBottom: 4 }}>
                  File Path
                </span>
                <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: SAGE[700], wordBreak: "break-all" }}>
                  {conn.database}
                </span>
              </div>
            ) : (
              <>
                <div>
                  <span style={{ fontFamily: FONTS.body, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: SAGE[500], display: "block", marginBottom: 4 }}>
                    Host
                  </span>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: SAGE[700] }}>
                    {conn.host}
                  </span>
                </div>
                <div>
                  <span style={{ fontFamily: FONTS.body, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: SAGE[500], display: "block", marginBottom: 4 }}>
                    Port
                  </span>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: SAGE[700] }}>
                    {conn.port}
                  </span>
                </div>
                <div>
                  <span style={{ fontFamily: FONTS.body, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: SAGE[500], display: "block", marginBottom: 4 }}>
                    Database
                  </span>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: SAGE[700] }}>
                    {conn.database}
                  </span>
                </div>
                <div>
                  <span style={{ fontFamily: FONTS.body, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: SAGE[500], display: "block", marginBottom: 4 }}>
                    Username
                  </span>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: SAGE[700] }}>
                    {conn.username}
                  </span>
                </div>
              </>
            )}
          </div>
          {/* Password and SSL fields */}
          {!conn.connected && (needsPassword || showSsl) && (
            <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "flex-end" }}>
              {needsPassword && (
                <div style={{ flex: 1 }}>
                  <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    placeholder="Enter database password"
                  />
                </div>
              )}
              {showSsl && (
                <label style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: FONTS.body,
                  fontSize: 13,
                  color: SAGE[700],
                  cursor: "pointer",
                  paddingBottom: 10,
                  whiteSpace: "nowrap",
                }}>
                  <input
                    type="checkbox"
                    checked={useSsl}
                    onChange={(e) => setUseSsl(e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  Use SSL
                </label>
              )}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: SAGE[500],
                marginBottom: 6,
              }}
            >
              Notes For AI Context
            </div>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Add guidance about key tables, naming, business rules, or safe query constraints..."
              rows={3}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: `1px solid ${SAGE[200]}`,
                background: CREAM[50],
                fontFamily: FONTS.body,
                fontSize: 13,
                color: SAGE[800],
                lineHeight: 1.5,
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[400] }}>
                Saved notes are injected into the model prompt for this connection.
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={savingNote}
                onClick={async (e) => {
                  e.stopPropagation();
                  setSavingNote(true);
                  try {
                    const err = await onSaveNote(conn.id, noteDraft);
                    if (err) showFeedback("error", err);
                    else showFeedback("success", "Note saved");
                  } finally {
                    setSavingNote(false);
                  }
                }}
              >
                {savingNote ? "Saving..." : "Save Note"}
              </Button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Button
              size="sm"
              variant={conn.connected ? "secondary" : "primary"}
              disabled={connecting}
              onClick={async (e) => {
                e.stopPropagation();
                setConnecting(true);
                try {
                  const err = await onToggle(conn.id, password, useSsl);
                  if (err) showFeedback("error", err);
                  else {
                    showFeedback("success", conn.connected ? "Disconnected" : "Connected successfully");
                    if (!conn.connected) setPassword("");
                  }
                } finally {
                  setConnecting(false);
                }
              }}
            >
              {connecting ? (conn.connected ? "Disconnecting..." : "Connecting...") : (conn.connected ? "Disconnect" : "Connect")}
            </Button>
            <Button size="sm" variant="secondary" disabled={testing} onClick={async (e) => {
              e.stopPropagation();
              setTesting(true);
              try {
                const err = await onTest(conn.id);
                if (err) showFeedback("error", `Test failed: ${err}`);
                else showFeedback("success", "Connection test passed");
              } finally {
                setTesting(false);
              }
            }}>
              <RefreshCw size={12} /> {testing ? "Testing..." : "Test"}
            </Button>
            <Button size="sm" variant="secondary" onClick={handleIntrospect} disabled={loadingSchema}>
              {loadingSchema ? "Loading..." : "Introspect"}
            </Button>
            {onUnlink && (
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onUnlink(conn.id); }}>
                <X size={12} /> Unlink
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onRemove(conn.id); }}>
              <Trash2 size={12} /> Remove
            </Button>
          </div>

          {/* Feedback message */}
          {feedback && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 12px",
                fontFamily: FONTS.mono,
                fontSize: 12,
                color: feedback.type === "success" ? "#3a7a3a" : "#c45c5c",
                background: feedback.type === "success" ? "#f0f7f0" : "#fdf0f0",
                border: `1px solid ${feedback.type === "success" ? "#c8e0c8" : "#f0d0d0"}`,
              }}
            >
              {feedback.message}
            </div>
          )}

          {/* Schema preview */}
          {schema && schema.length > 0 && (
            <div style={{ marginTop: 16, borderTop: `1px solid ${SAGE[50]}`, paddingTop: 12 }}>
              <span style={{ fontFamily: FONTS.body, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: SAGE[500], display: "block", marginBottom: 8 }}>
                Schema ({schema.length} tables)
              </span>
              {schema.map((table) => (
                <div key={table.name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: SAGE[700] }}>{table.name}</span>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[400] }}>
                    {table.columns.length} cols / {table.row_count.toLocaleString()} rows
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

interface AddConnectionFormProps {
  onClose: () => void;
  onAdd: (conn: DatabaseConnection) => void;
}

const DB_TYPES: string[] = ["PostgreSQL", "MySQL", "SQLite", "Redis"];

const DEFAULT_PORTS: Record<string, string> = {
  PostgreSQL: "5432",
  MySQL: "3306",
  SQLite: "0",
  Redis: "6379",
};

function AddConnectionForm({ onClose, onAdd }: AddConnectionFormProps) {
  const [name, setName] = useState("");
  const [dbType, setDbType] = useState("PostgreSQL");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [useSsl, setUseSsl] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSqlite = dbType === "SQLite";
  const isRedis = dbType === "Redis";
  const needsPassword = !isSqlite && !isRedis;
  const showSsl = dbType === "PostgreSQL" || dbType === "MySQL";

  const handleTypeChange = (type: string) => {
    setDbType(type);
    setPort(DEFAULT_PORTS[type] || "5432");
    if (type === "SQLite") {
      setHost("");
      setUsername("");
    }
  };

  const handleBrowse = async () => {
    const selected = await open({
      multiple: false,
      filters: [
        { name: "SQLite Database", extensions: ["db", "sqlite", "sqlite3", "db3"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (selected) {
      setDatabase(selected);
      if (!name.trim()) {
        const fileName = selected.split("/").pop()?.split("\\").pop() || "";
        setName(fileName.replace(/\.(db|sqlite|sqlite3|db3)$/i, ""));
      }
    }
  };

  const canSubmit = isSqlite
    ? database.trim().length > 0
    : name.trim().length > 0 && host.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const conn = await addConnection({
        name: (name.trim() || (isSqlite ? database.split("/").pop() || "SQLite" : "Connection")),
        dbType,
        host: isSqlite ? "localhost" : host.trim(),
        port: parseInt(port, 10) || 0,
        database: database.trim(),
        username: username.trim(),
      });
      // Auto-connect with password if provided
      try {
        await connectDatabase(conn.id, password, useSsl);
        conn.connected = true;
        conn.password = password;
        conn.use_ssl = useSsl;
      } catch (connectErr: unknown) {
        // Connection saved but connect failed — still add it
        const msg = connectErr instanceof Error ? connectErr.message : String(connectErr);
        conn.connected = false;
        conn.password = password;
        conn.use_ssl = useSsl;
        setError(`Connection saved but connect failed: ${msg}`);
      }
      onAdd(conn);
      if (!error) onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ fontFamily: FONTS.body, fontSize: 14, fontWeight: 600, color: SAGE[900], margin: 0 }}>
          New Connection
        </h3>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
        >
          <X size={16} color={SAGE[400]} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Input label="Connection Name" value={name} onChange={setName} placeholder={isSqlite ? "My SQLite DB" : "My Database"} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontFamily: FONTS.body, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: SAGE[500] }}>
            Database Type
          </label>
          <select
            value={dbType}
            onChange={(e) => handleTypeChange(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: `1px solid ${SAGE[200]}`,
              background: CREAM[50],
              fontFamily: FONTS.body,
              fontSize: 14,
              color: SAGE[900],
              outline: "none",
              appearance: "none",
            }}
          >
            {DB_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {isSqlite ? (
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontFamily: FONTS.body, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: SAGE[500], display: "block", marginBottom: 6 }}>
              Database File
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <div
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  border: `1px solid ${SAGE[200]}`,
                  background: CREAM[50],
                  fontFamily: FONTS.mono,
                  fontSize: 13,
                  color: database ? SAGE[900] : SAGE[400],
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minHeight: 40,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {database || "No file selected"}
              </div>
              <Button size="sm" variant="secondary" onClick={handleBrowse}>
                <FolderOpen size={14} /> Browse
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Input label="Host" value={host} onChange={setHost} placeholder="localhost" />
            <Input label="Port" value={port} onChange={setPort} placeholder={DEFAULT_PORTS[dbType]} />
            {!isRedis && (
              <Input label="Database" value={database} onChange={setDatabase} placeholder="my_database" />
            )}
            {!isRedis && (
              <Input label="Username" value={username} onChange={setUsername} placeholder="postgres" />
            )}
            {needsPassword && (
              <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="Enter password" />
            )}
            {showSsl && (
              <label style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 6,
                fontFamily: FONTS.body,
                fontSize: 13,
                color: SAGE[700],
                cursor: "pointer",
                paddingBottom: 10,
              }}>
                <input
                  type="checkbox"
                  checked={useSsl}
                  onChange={(e) => setUseSsl(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                Use SSL
              </label>
            )}
          </>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: 12,
          padding: "8px 12px",
          fontFamily: FONTS.mono,
          fontSize: 12,
          color: "#c45c5c",
          background: "#fdf0f0",
          border: "1px solid #f0d0d0",
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <Button size="sm" onClick={handleSubmit} disabled={submitting || !canSubmit}>
          {submitting ? "Connecting..." : isSqlite ? "Add Connection" : "Test & Connect"}
        </Button>
        <Button size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </Card>
  );
}

export function Connections({ projectId }: { projectId?: string }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [allConnections, setAllConnections] = useState<DatabaseConnection[]>([]);
  const [connectionNotes, setConnectionNotes] = useState<Record<string, ConnectionNote>>({});
  const [loading, setLoading] = useState(true);

  const loadConnections = useCallback(async () => {
    try {
      if (projectId) {
        const [projConns, globalConns, notes] = await Promise.all([
          listProjectConnections(projectId),
          listConnections(),
          listConnectionNotes(),
        ]);
        setConnections(projConns);
        setAllConnections(globalConns);
        setConnectionNotes(
          notes.reduce<Record<string, ConnectionNote>>((acc, note) => {
            acc[note.connection_id] = note;
            return acc;
          }, {})
        );
      } else {
        const [conns, notes] = await Promise.all([
          listConnections(),
          listConnectionNotes(),
        ]);
        setConnections(conns);
        setAllConnections(conns);
        setConnectionNotes(
          notes.reduce<Record<string, ConnectionNote>>((acc, note) => {
            acc[note.connection_id] = note;
            return acc;
          }, {})
        );
      }
    } catch {
      // Load failed
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // Auto-connect once per project per app session.
  const [autoConnecting, setAutoConnecting] = useState(false);
  useEffect(() => {
    if (!projectId || loading || AUTO_CONNECT_ATTEMPTED.has(projectId)) return;
    AUTO_CONNECT_ATTEMPTED.add(projectId);
    setAutoConnecting(true);
    autoConnectProjectConnections(projectId).then((connectedIds) => {
      if (connectedIds.length > 0) {
        loadConnections();
      }
    }).catch(() => {}).finally(() => setAutoConnecting(false));
  }, [projectId, loading, loadConnections]);

  // Connections available to link (global minus already linked)
  const unlinkableConnections = allConnections.filter(
    (gc) => !connections.some((c) => c.id === gc.id)
  );

  const handleToggle = useCallback(async (id: string, password: string, useSsl: boolean): Promise<string | null> => {
    const conn = connections.find((c) => c.id === id);
    if (!conn) return "Connection not found";
    try {
      if (conn.connected) {
        await disconnectDatabase(id);
        setConnections((prev) =>
          prev.map((c) => (c.id === id ? { ...c, connected: false } : c))
        );
      } else {
        const result = await connectDatabase(id, password, useSsl);
        if (result) {
          setConnections((prev) =>
            prev.map((c) => (c.id === id ? { ...c, connected: true } : c))
          );
        } else {
          return "Connection failed -- check your credentials";
        }
      }
      return null;
    } catch (err: unknown) {
      return err instanceof Error ? err.message : String(err);
    }
  }, [connections]);

  const handleRemove = useCallback(async (id: string) => {
    try {
      await removeConnection(id);
      setConnections((prev) => prev.filter((c) => c.id !== id));
      setAllConnections((prev) => prev.filter((c) => c.id !== id));
      setConnectionNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch {
      // handle silently
    }
  }, []);

  const handleTest = useCallback(async (id: string): Promise<string | null> => {
    try {
      const result = await testConnection(id);
      if (result) {
        setConnections((prev) =>
          prev.map((c) => (c.id === id ? { ...c, connected: true } : c))
        );
        return null;
      }
      return "Connection is not active -- connect first";
    } catch (err: unknown) {
      return err instanceof Error ? err.message : String(err);
    }
  }, []);

  const handleSaveNote = useCallback(async (id: string, note: string): Promise<string | null> => {
    try {
      const saved = await setConnectionNote(id, note);
      setConnectionNotes((prev) => {
        const next = { ...prev };
        if (saved.note.trim().length === 0) {
          delete next[id];
        } else {
          next[id] = saved;
        }
        return next;
      });
      return null;
    } catch (err: unknown) {
      return err instanceof Error ? err.message : String(err);
    }
  }, []);

  const handleAdd = useCallback(async (conn: DatabaseConnection) => {
    setConnections((prev) => [...prev, conn]);
    setAllConnections((prev) => [...prev, conn]);
    // Auto-link to project
    if (projectId) {
      try {
        await linkConnectionToProject(projectId, conn.id);
      } catch {
        // Link failed silently
      }
    }
  }, [projectId]);

  const handleUnlink = useCallback(async (connectionId: string) => {
    if (!projectId) return;
    try {
      await unlinkConnectionFromProject(projectId, connectionId);
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    } catch {
      // Unlink failed
    }
  }, [projectId]);

  const handleLinkExisting = useCallback(async (connectionId: string) => {
    if (!projectId) return;
    try {
      await linkConnectionToProject(projectId, connectionId);
      const linked = allConnections.find((c) => c.id === connectionId);
      if (linked) {
        setConnections((prev) => [...prev, linked]);
      }
    } catch {
      // Link failed
    }
  }, [projectId, allConnections]);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 32 }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div>
            <h1 style={{ fontFamily: FONTS.display, fontSize: 28, fontWeight: 400, color: SAGE[900], margin: 0 }}>
              Connections
            </h1>
            <p style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[500], marginTop: 4 }}>
              {projectId ? "Connections linked to this project" : "Manage your database connections"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {projectId && unlinkableConnections.length > 0 && !showLinkPicker && (
              <Button size="sm" variant="secondary" onClick={() => setShowLinkPicker(true)}>
                <Plus size={12} /> Link Existing
              </Button>
            )}
            {!showAdd && (
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <Plus size={12} /> Add Connection
              </Button>
            )}
          </div>
        </div>

        {/* Link existing connection picker */}
        {showLinkPicker && projectId && (
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontFamily: FONTS.body, fontSize: 14, fontWeight: 600, color: SAGE[900], margin: 0 }}>
                Link an existing connection
              </h3>
              <button
                onClick={() => setShowLinkPicker(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
              >
                <X size={16} color={SAGE[400]} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {unlinkableConnections.map((gc) => (
                <div
                  key={gc.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    border: `1px solid ${SAGE[100]}`,
                    background: CREAM[50],
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Database size={16} color={SAGE[400]} />
                    <div>
                      <span style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 500, color: SAGE[900] }}>
                        {gc.name}
                      </span>
                      <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[400], marginLeft: 8 }}>
                        {gc.db_type}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await handleLinkExisting(gc.id);
                      if (unlinkableConnections.length <= 1) setShowLinkPicker(false);
                    }}
                  >
                    Link
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {showAdd && <AddConnectionForm onClose={() => setShowAdd(false)} onAdd={handleAdd} />}

        {autoConnecting && (
          <div
            style={{
              padding: "8px 12px",
              marginBottom: 8,
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: SAGE[500],
              background: SAGE[50],
              border: `1px solid ${SAGE[100]}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <RefreshCw size={12} color={SAGE[400]} style={{ animation: "spin 1s linear infinite" }} />
            Auto-connecting saved connections...
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center" }}>
              <span style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[400] }}>Loading connections...</span>
            </div>
          ) : connections.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center" }}>
              <span style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[400] }}>
                {projectId ? "No connections linked to this project" : "No connections configured"}
              </span>
            </div>
          ) : (
            connections.map((conn) => (
              <ConnectionCard
                key={conn.id}
                conn={conn}
                note={connectionNotes[conn.id]?.note || ""}
                onToggle={handleToggle}
                onRemove={handleRemove}
                onTest={handleTest}
                onSaveNote={handleSaveNote}
                onUnlink={projectId ? handleUnlink : undefined}
              />
            ))
          )}
        </div>

        {/* CSV Import */}
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontFamily: FONTS.body, fontSize: 14, fontWeight: 600, color: SAGE[900], margin: "0 0 12px" }}>
            Import CSV
          </h2>
          <p style={{ fontFamily: FONTS.body, fontSize: 12, color: SAGE[500], marginBottom: 16 }}>
            Import a CSV file as a queryable table
          </p>
          <CsvImport />
        </div>
      </div>
    </div>
  );
}
