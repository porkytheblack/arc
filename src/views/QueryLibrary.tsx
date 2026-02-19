import { useState, useEffect, useCallback } from "react";
import { SAGE, CREAM, FONTS } from "../lib/theme";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Tag } from "../components/Tag";
import { Input } from "../components/Input";
import {
  listSavedQueries,
  saveQuery,
  deleteSavedQuery,
  executeQuery,
  listConnections,
} from "../lib/commands";
import type { SavedQuery, QueryResult, DatabaseConnection } from "../lib/commands";
import { DataTable } from "../components/DataTable";
import { extractSavedQueryParams } from "../lib/saved-query-utils";
import { Search, Play, Copy, Plus, Trash2, X } from "lucide-react";

interface QueryCardProps {
  query: SavedQuery;
  onRun: (query: SavedQuery) => void;
  onDelete: (id: string) => void;
}

function QueryCard({ query, onRun, onDelete }: QueryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const requiredParams = extractSavedQueryParams(query.sql);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(query.sql).catch(() => {});
  };

  return (
    <Card
      style={{ padding: 0, cursor: "pointer" }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <h3
              style={{
                fontFamily: FONTS.body,
                fontSize: 14,
                fontWeight: 500,
                color: SAGE[900],
                margin: 0,
              }}
            >
              {query.name}
            </h3>
            <p
              style={{
                fontFamily: FONTS.body,
                fontSize: 12,
                color: SAGE[500],
                margin: "4px 0 0",
              }}
            >
              {query.description}
            </p>
            {requiredParams.length > 0 && (
              <p
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 10,
                  color: SAGE[400],
                  margin: "6px 0 0",
                }}
              >
                params: {requiredParams.join(", ")}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <Tag>{query.connection_id}</Tag>
            <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[300] }}>
              {query.created_at}
            </span>
          </div>
        </div>

        {expanded && (
          <div style={{ marginTop: 16, animation: "fadeIn 0.2s ease" }}>
            <div
              style={{
                background: SAGE[950],
                padding: "12px 16px",
                overflow: "auto",
              }}
            >
              <code
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  color: SAGE[200],
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                }}
              >
                {query.sql}
              </code>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Button size="sm" onClick={(e) => { e.stopPropagation(); onRun(query); }}>
                <Play size={12} /> Run
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCopy}>
                <Copy size={12} /> Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(query.id); }}>
                <Trash2 size={12} /> Delete
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

interface NewQueryFormProps {
  connections: DatabaseConnection[];
  onClose: () => void;
  onSave: (query: SavedQuery) => void;
}

function NewQueryForm({ connections, onClose, onSave }: NewQueryFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sql, setSql] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!connectionId && connections.length > 0) {
      const connected = connections.find((c) => c.connected);
      setConnectionId((connected || connections[0]).id);
    }
  }, [connections, connectionId]);

  const handleSave = async () => {
    if (!name.trim() || !sql.trim()) return;
    setSubmitting(true);
    try {
      const query = await saveQuery({
        name: name.trim(),
        description: description.trim(),
        sql: sql.trim(),
        connectionId: connectionId || "conn-1",
      });
      onSave(query);
      onClose();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontFamily: FONTS.body, fontSize: 14, fontWeight: 600, color: SAGE[900], margin: 0 }}>
          New Query
        </h3>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <X size={16} color={SAGE[400]} />
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Input label="Name" value={name} onChange={setName} placeholder="My Query" />
        <Input label="Description" value={description} onChange={setDescription} placeholder="What does this query do?" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontFamily: FONTS.body, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: SAGE[500] }}>
            Connection
          </label>
          <select
            value={connectionId}
            onChange={(e) => setConnectionId(e.target.value)}
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
            {connections.length === 0 && <option value="">No connections available</option>}
            {connections.map((conn) => (
              <option key={conn.id} value={conn.id}>
                {conn.name} ({conn.db_type})
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontFamily: FONTS.body, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: SAGE[500] }}>
            SQL
          </label>
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder="SELECT * FROM ..."
            rows={4}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: `1px solid ${SAGE[200]}`,
              background: CREAM[50],
              fontFamily: FONTS.mono,
              fontSize: 13,
              color: SAGE[900],
              outline: "none",
              boxSizing: "border-box",
              resize: "vertical",
              lineHeight: 1.6,
            }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={submitting || !name.trim() || !sql.trim() || !connectionId}
        >
          {submitting ? "Saving..." : "Save Query"}
        </Button>
        <Button size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </Card>
  );
}

export function QueryLibrary() {
  const [search, setSearch] = useState("");
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [runResult, setRunResult] = useState<{ query: SavedQuery; result: QueryResult } | null>(null);

  useEffect(() => {
    Promise.all([listSavedQueries(), listConnections()])
      .then(([q, conns]) => {
        setQueries(q);
        setConnections(conns);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = queries.filter(
    (q) =>
      q.name.toLowerCase().includes(search.toLowerCase()) ||
      q.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleRun = useCallback(async (query: SavedQuery) => {
    try {
      const result = await executeQuery(query.connection_id, query.sql);
      setRunResult({ query, result });
    } catch {
      // handle silently
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteSavedQuery(id);
      setQueries((prev) => prev.filter((q) => q.id !== id));
    } catch {
      // handle silently
    }
  }, []);

  const handleSave = useCallback((query: SavedQuery) => {
    setQueries((prev) => [...prev, query]);
  }, []);

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
              Query Library
            </h1>
            <p style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[500], marginTop: 4 }}>
              {queries.length} saved queries
            </p>
          </div>
          {!showNew && (
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus size={12} /> New Query
            </Button>
          )}
        </div>

        {showNew && (
          <NewQueryForm
            connections={connections}
            onClose={() => setShowNew(false)}
            onSave={handleSave}
          />
        )}

        {/* Run result display */}
        {runResult && (
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: SAGE[900] }}>
                Results: {runResult.query.name}
              </span>
              <button
                onClick={() => setRunResult(null)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
              >
                <X size={14} color={SAGE[400]} />
              </button>
            </div>
            <DataTable
              columns={runResult.result.columns}
              rows={runResult.result.rows as (string | number | boolean | null)[][]}
            />
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[400] }}>
                {runResult.result.row_count} rows
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[400] }}>
                {runResult.result.execution_time_ms}ms
              </span>
            </div>
          </Card>
        )}

        {/* Search */}
        <div style={{ marginBottom: 20, position: "relative" }}>
          <Search
            size={16}
            color={SAGE[400]}
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search queries..."
            style={{
              width: "100%",
              padding: "10px 12px 10px 36px",
              border: `1px solid ${SAGE[200]}`,
              background: CREAM[50],
              fontFamily: FONTS.body,
              fontSize: 14,
              color: SAGE[900],
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.2s ease",
            }}
            onFocus={(e) => (e.target.style.borderColor = SAGE[500])}
            onBlur={(e) => (e.target.style.borderColor = SAGE[200])}
          />
        </div>

        {/* Query list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <span style={{ fontFamily: FONTS.body, fontSize: 14, color: SAGE[400] }}>Loading queries...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 48,
                fontFamily: FONTS.body,
                fontSize: 14,
                color: SAGE[400],
              }}
            >
              {search ? "No queries match your search." : "No saved queries yet."}
            </div>
          ) : (
            filtered.map((q) => (
              <QueryCard key={q.id} query={q} onRun={handleRun} onDelete={handleDelete} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
