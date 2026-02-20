import { useCallback, useEffect, useMemo, useState } from "react";
import { SAGE, CREAM, FONTS } from "../lib/theme";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Input } from "../components/Input";
import {
  listConnections,
  listProjectConnections,
  listConnectionNotes,
  setConnectionNote,
} from "../lib/commands";
import type { ConnectionNote, DatabaseConnection } from "../lib/commands";
import { Search, Save, StickyNote, RefreshCw } from "lucide-react";

function toNotesMap(notes: ConnectionNote[]): Record<string, ConnectionNote> {
  return notes.reduce<Record<string, ConnectionNote>>((acc, note) => {
    acc[note.connection_id] = note;
    return acc;
  }, {});
}

export function Notes({ projectId }: { projectId?: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [notesByConnection, setNotesByConnection] = useState<Record<string, ConnectionNote>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<Record<string, { type: "success" | "error"; message: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [conns, notes] = await Promise.all([
        projectId ? listProjectConnections(projectId) : listConnections(),
        listConnectionNotes(),
      ]);
      const map = toNotesMap(notes);
      setConnections(conns);
      setNotesByConnection(map);
      setDrafts(
        conns.reduce<Record<string, string>>((acc, conn) => {
          acc[conn.id] = map[conn.id]?.note || "";
          return acc;
        }, {})
      );
    } catch {
      setConnections([]);
      setNotesByConnection({});
      setDrafts({});
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback(async (connectionId: string) => {
    setSaving((prev) => ({ ...prev, [connectionId]: true }));
    try {
      const saved = await setConnectionNote(connectionId, drafts[connectionId] || "");
      setNotesByConnection((prev) => {
        const next = { ...prev };
        if (!saved.note.trim()) {
          delete next[connectionId];
        } else {
          next[connectionId] = saved;
        }
        return next;
      });
      setDrafts((prev) => ({ ...prev, [connectionId]: saved.note }));
      setFeedback((prev) => ({
        ...prev,
        [connectionId]: {
          type: "success",
          message: saved.note.trim() ? "Note saved" : "Note cleared",
        },
      }));
      window.dispatchEvent(new CustomEvent("arc:notes-updated"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setFeedback((prev) => ({
        ...prev,
        [connectionId]: { type: "error", message },
      }));
    } finally {
      setSaving((prev) => ({ ...prev, [connectionId]: false }));
    }
  }, [drafts]);

  const filteredConnections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter((conn) => {
      const note = (drafts[conn.id] || "").toLowerCase();
      return (
        conn.name.toLowerCase().includes(q) ||
        conn.db_type.toLowerCase().includes(q) ||
        conn.database.toLowerCase().includes(q) ||
        conn.id.toLowerCase().includes(q) ||
        note.includes(q)
      );
    });
  }, [connections, drafts, search]);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 28 }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div>
            <h1 style={{ fontFamily: FONTS.display, fontSize: 28, fontWeight: 400, color: SAGE[900], margin: 0 }}>
              Notes
            </h1>
            <p style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[500], marginTop: 4 }}>
              Add business context that is not present in schema. These notes are injected into the agent prompt.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw size={12} /> {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Search size={14} color={SAGE[400]} />
            <div style={{ flex: 1 }}>
              <Input
                value={search}
                onChange={setSearch}
                placeholder="Search by connection name, id, db type, or note content"
              />
            </div>
          </div>
        </Card>

        {loading ? (
          <Card>
            <span style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[400] }}>Loading notes...</span>
          </Card>
        ) : filteredConnections.length === 0 ? (
          <Card>
            <span style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[400] }}>
              {connections.length === 0
                ? (projectId ? "No project connections available for notes yet." : "No connections available for notes yet.")
                : "No connections match your search."}
            </span>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredConnections.map((conn) => {
              const savedValue = notesByConnection[conn.id]?.note || "";
              const draftValue = drafts[conn.id] || "";
              const dirty = draftValue !== savedValue;
              const status = feedback[conn.id];

              return (
                <Card key={conn.id} style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: FONTS.body, fontSize: 14, fontWeight: 600, color: SAGE[900] }}>
                          {conn.name}
                        </span>
                        <Badge variant={conn.connected ? "success" : "default"}>
                          {conn.connected ? "Connected" : "Disconnected"}
                        </Badge>
                      </div>
                      <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[400] }}>{conn.db_type}</span>
                        <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[400] }}>{conn.id}</span>
                        <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[400] }}>
                          {conn.db_type === "SQLite" ? conn.database : `${conn.host}:${conn.port}/${conn.database}`}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {dirty && (
                        <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[500] }}>
                          Unsaved
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!dirty || Boolean(saving[conn.id])}
                        onClick={() => handleSave(conn.id)}
                      >
                        <Save size={12} /> {saving[conn.id] ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>

                  <div style={{ position: "relative" }}>
                    <StickyNote size={14} color={SAGE[300]} style={{ position: "absolute", top: 10, left: 10 }} />
                    <textarea
                      value={draftValue}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [conn.id]: e.target.value }))
                      }
                      placeholder="Add guidance: business rules, canonical fields, joins, safe filters, naming conventions, exclusions..."
                      rows={4}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 12px 10px 32px",
                        border: `1px solid ${SAGE[200]}`,
                        background: CREAM[50],
                        fontFamily: FONTS.body,
                        fontSize: 13,
                        color: SAGE[800],
                        lineHeight: 1.5,
                        outline: "none",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[400] }}>
                      {draftValue.trim().length} chars
                    </span>
                    {status && (
                      <span
                        style={{
                          fontFamily: FONTS.mono,
                          fontSize: 10,
                          color: status.type === "success" ? "#2e7d32" : "#c45c5c",
                        }}
                      >
                        {status.message}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
