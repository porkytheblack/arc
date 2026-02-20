import { useState, useEffect } from "react";
import { SAGE, FONTS } from "../lib/theme";
import { Card } from "../components/Card";
import { Tag } from "../components/Tag";
import { Select } from "../components/Select";
import { listConnections, getSchema } from "../lib/commands";
import type { DatabaseConnection, TableSchema } from "../lib/commands";
import { Table2, Key, ChevronDown, ChevronRight } from "lucide-react";

interface TableCardProps {
  table: TableSchema;
}

function TableCard({ table }: TableCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card style={{ padding: 0, cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
      <div
        style={{
          padding: "14px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {expanded ? (
            <ChevronDown size={14} color={SAGE[400]} />
          ) : (
            <ChevronRight size={14} color={SAGE[400]} />
          )}
          <Table2 size={16} color={SAGE[500]} />
          <span style={{ fontFamily: FONTS.mono, fontSize: 14, color: SAGE[900], fontWeight: 500 }}>
            {table.name}
          </span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[400] }}>
            {table.columns.length} columns
          </span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: SAGE[400] }}>
            {table.row_count.toLocaleString()} rows
          </span>
        </div>
      </div>

      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${SAGE[50]}`,
            animation: "fadeIn 0.2s ease",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                {["Column", "Type", "Attributes"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 20px",
                      textAlign: "left",
                      fontFamily: FONTS.body,
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: SAGE[500],
                      background: SAGE[50],
                      borderBottom: `1px solid ${SAGE[100]}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col) => (
                <tr key={col.name}>
                  <td
                    style={{
                      padding: "8px 20px",
                      fontFamily: FONTS.mono,
                      fontSize: 13,
                      color: SAGE[900],
                      borderBottom: `1px solid ${SAGE[50]}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {col.primary_key && <Key size={12} color={SAGE[500]} />}
                    {col.name}
                  </td>
                  <td
                    style={{
                      padding: "8px 20px",
                      fontFamily: FONTS.mono,
                      fontSize: 12,
                      color: SAGE[500],
                      borderBottom: `1px solid ${SAGE[50]}`,
                    }}
                  >
                    {col.data_type}
                  </td>
                  <td
                    style={{
                      padding: "8px 20px",
                      borderBottom: `1px solid ${SAGE[50]}`,
                    }}
                  >
                    <div style={{ display: "flex", gap: 4 }}>
                      {col.primary_key && <Tag>PK</Tag>}
                      {!col.nullable && <Tag>NOT NULL</Tag>}
                      {col.nullable && <Tag style={{ color: SAGE[300] }}>NULLABLE</Tag>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function SchemaViewer() {
  const [schemas, setSchemas] = useState<TableSchema[]>([]);
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [selectedConn, setSelectedConn] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [totalRows, setTotalRows] = useState(0);

  useEffect(() => {
    listConnections()
      .then((conns) => {
        setConnections(conns);
        if (conns.length > 0) {
          setSelectedConn(conns[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedConn) return;
    setLoading(true);
    getSchema(selectedConn)
      .then((s) => {
        setSchemas(s);
        setTotalRows(s.reduce((sum, t) => sum + t.row_count, 0));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedConn]);

  const connName = connections.find((c) => c.id === selectedConn)?.name || "Database";

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 32 }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontFamily: FONTS.display, fontSize: 28, fontWeight: 400, color: SAGE[900], margin: 0 }}>
                Schema
              </h1>
              <p style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[500], marginTop: 4 }}>
                {connName} --- {schemas.length} tables, {totalRows.toLocaleString()} total rows
              </p>
            </div>
            {connections.length > 1 && (
              <Select
                value={selectedConn}
                onChange={setSelectedConn}
                options={connections.map((c) => ({ value: c.id, label: c.name }))}
                style={{
                  minWidth: 180,
                }}
              />
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center" }}>
              <span style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[400] }}>Loading schema...</span>
            </div>
          ) : schemas.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center" }}>
              <span style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[400] }}>No tables found</span>
            </div>
          ) : (
            schemas.map((table) => (
              <TableCard key={table.name} table={table} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
