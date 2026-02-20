import { useState, useEffect, useCallback } from "react";
import { SAGE, FONTS } from "../lib/theme";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { listTableLinks, addTableLink, removeTableLink } from "../lib/commands";
import type { TableLink } from "../lib/commands";
import { ArrowRight, Plus, Trash2, Link as LinkIcon } from "lucide-react";

export function TableLinks() {
  const [links, setLinks] = useState<TableLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  // Form state
  const [sourceTable, setSourceTable] = useState("");
  const [sourceColumn, setSourceColumn] = useState("");
  const [targetTable, setTargetTable] = useState("");
  const [targetColumn, setTargetColumn] = useState("");
  const [label, setLabel] = useState("");
  const [connectionId, setConnectionId] = useState("conn-1");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const loadLinks = useCallback(async () => {
    try {
      const data = await listTableLinks();
      setLinks(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : typeof err === "string" ? err : "Failed to load table links";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const resetForm = () => {
    setSourceTable("");
    setSourceColumn("");
    setTargetTable("");
    setTargetColumn("");
    setLabel("");
    setConnectionId("conn-1");
  };

  const handleSubmit = async () => {
    if (!sourceTable.trim() || !sourceColumn.trim() || !targetTable.trim() || !targetColumn.trim()) {
      setError("Source table, source column, target table, and target column are all required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const newLink = await addTableLink({
        sourceTable: sourceTable.trim(),
        sourceColumn: sourceColumn.trim(),
        targetTable: targetTable.trim(),
        targetColumn: targetColumn.trim(),
        label: label.trim(),
        connectionId: connectionId.trim() || "conn-1",
      });
      setLinks((prev) => [...prev, newLink]);
      resetForm();
      setShowForm(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : typeof err === "string" ? err : "Failed to create table link";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (linkId: string) => {
    try {
      await removeTableLink(linkId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : typeof err === "string" ? err : "Failed to delete table link";
      setError(message);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: 24,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "all 0.35s ease",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header with add button */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 13,
                fontWeight: 600,
                color: SAGE[900],
              }}
            >
              {links.length === 0
                ? "No table links defined"
                : `${links.length} table ${links.length === 1 ? "link" : "links"}`}
            </span>
          </div>
          <Button
            size="sm"
            variant={showForm ? "secondary" : "primary"}
            onClick={() => {
              setShowForm(!showForm);
              if (showForm) {
                resetForm();
                setError(null);
              }
            }}
          >
            <Plus size={14} />
            {showForm ? "Cancel" : "New Link"}
          </Button>
        </div>

        {/* Error display */}
        {error && (
          <Card style={{ marginBottom: 16, borderColor: "#c45c5c" }}>
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 13,
                color: "#c45c5c",
              }}
            >
              {error}
            </span>
          </Card>
        )}

        {/* Create form */}
        {showForm && (
          <Card style={{ marginBottom: 24 }}>
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 13,
                fontWeight: 600,
                color: SAGE[900],
                display: "block",
                marginBottom: 16,
              }}
            >
              Define Relationship
            </span>

            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              {/* Source side */}
              <div style={{ flex: 1 }}>
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: SAGE[400],
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  Source
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <Input
                    value={sourceTable}
                    onChange={setSourceTable}
                    placeholder="users"
                    label="Table"
                  />
                  <Input
                    value={sourceColumn}
                    onChange={setSourceColumn}
                    placeholder="id"
                    label="Column"
                  />
                </div>
              </div>

              {/* Arrow */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  paddingTop: 24,
                }}
              >
                <ArrowRight size={20} color={SAGE[300]} />
              </div>

              {/* Target side */}
              <div style={{ flex: 1 }}>
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: SAGE[400],
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  Target
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <Input
                    value={targetTable}
                    onChange={setTargetTable}
                    placeholder="orders"
                    label="Table"
                  />
                  <Input
                    value={targetColumn}
                    onChange={setTargetColumn}
                    placeholder="user_id"
                    label="Column"
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <Input
                  value={label}
                  onChange={setLabel}
                  placeholder="has many"
                  label="Label (optional)"
                />
              </div>
              <div style={{ flex: 1 }}>
                <Input
                  value={connectionId}
                  onChange={setConnectionId}
                  placeholder="conn-1"
                  label="Connection ID"
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Creating..." : "Create Link"}
              </Button>
            </div>
          </Card>
        )}

        {/* Links list */}
        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: 64,
            }}
          >
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 14,
                color: SAGE[400],
              }}
            >
              Loading...
            </span>
          </div>
        ) : links.length === 0 && !showForm ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 64,
              gap: 16,
            }}
          >
            <LinkIcon size={40} color={SAGE[200]} strokeWidth={1} />
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 14,
                color: SAGE[400],
              }}
            >
              Define relationships between your database tables
            </span>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus size={14} />
              Create First Link
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {links.map((link, index) => (
              <LinkCard
                key={link.id}
                link={link}
                index={index}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LinkCard({
  link,
  index,
  onDelete,
}: {
  link: TableLink;
  index: number;
  onDelete: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [deleteHovered, setDeleteHovered] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30 + index * 20);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <Card
      style={{
        padding: 16,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "all 0.3s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Relationship display */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          {/* Source */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 14,
                fontWeight: 600,
                color: SAGE[900],
              }}
            >
              {link.source_table}
            </span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 12,
                color: SAGE[500],
              }}
            >
              {link.source_column}
            </span>
          </div>

          {/* Arrow with label */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            {link.label && (
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 11,
                  color: SAGE[400],
                  fontStyle: "italic",
                }}
              >
                {link.label}
              </span>
            )}
            <ArrowRight size={16} color={SAGE[300]} />
          </div>

          {/* Target */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 14,
                fontWeight: 600,
                color: SAGE[900],
              }}
            >
              {link.target_table}
            </span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 12,
                color: SAGE[500],
              }}
            >
              {link.target_column}
            </span>
          </div>

          {/* Connection badge */}
          <div style={{ marginLeft: 16 }}>
            <Badge>{link.connection_id}</Badge>
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={() => onDelete(link.id)}
          onMouseEnter={() => setDeleteHovered(true)}
          onMouseLeave={() => setDeleteHovered(false)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 6,
            opacity: deleteHovered ? 1 : 0.4,
            transition: "opacity 0.2s ease",
          }}
          title="Delete link"
        >
          <Trash2 size={14} color={SAGE[500]} />
        </button>
      </div>
    </Card>
  );
}
