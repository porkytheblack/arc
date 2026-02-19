import { useState, useEffect } from "react";
import { SAGE, CREAM, FONTS } from "../lib/theme";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import {
  listConnections,
  listProjectConnections,
  listExplorations,
  listSavedQueries,
  getDatabaseStats,
} from "../lib/commands";
import type {
  DatabaseConnection,
  Exploration,
  SavedQuery,
  DatabaseStats,
} from "../lib/commands";
import { Database, MessageSquare, BarChart3, BookOpen, ArrowRight, HardDrive, Rows3, Activity } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface StatItem {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
}

export interface WorkspaceHomeProps {
  onNavigate: (view: string) => void;
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function WorkspaceHome({ onNavigate, projectId, projectName, projectDescription }: WorkspaceHomeProps) {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [explorations, setExplorations] = useState<Exploration[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      let loadedConnections: DatabaseConnection[] = [];
      try {
        const [conns, exps, queries] = await Promise.all([
          projectId ? listProjectConnections(projectId) : listConnections(),
          listExplorations(projectId || "proj-1"),
          listSavedQueries(),
        ]);
        loadedConnections = conns;
        setConnections(conns);
        setExplorations(exps);
        if (projectId) {
          const scopedIds = new Set(conns.map((c) => c.id));
          setSavedQueries(queries.filter((q) => scopedIds.has(q.connection_id)));
        } else {
          setSavedQueries(queries);
        }
      } catch {
        // use empty arrays as fallback
      }
      setLoading(false);
      setStats(null);

      // Fetch stats in the background; do not block Home rendering.
      const activeConn = loadedConnections.find((c) => c.connected);
      if (activeConn) {
        getDatabaseStats(activeConn.id)
          .then(setStats)
          .catch(() => {
            // stats are optional
          });
      }
    };
    loadData();
  }, [projectId]);

  const statItems: StatItem[] = [
    { label: "Data Sources", value: String(connections.length), icon: Database, color: SAGE[500] },
    { label: "Explorations", value: String(explorations.length), icon: MessageSquare, color: SAGE[600] },
    { label: "Charts", value: String(Math.max(explorations.length - 1, 0)), icon: BarChart3, color: SAGE[700] },
    { label: "Saved Queries", value: String(savedQueries.length), icon: BookOpen, color: SAGE[800] },
  ];

  const connectedCount = connections.filter((conn) => conn.connected).length;
  const recentExplorations = explorations.slice(0, 4);
  const recentQueries = savedQueries.slice(0, 4);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 28 }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <Card style={{ padding: 0, marginBottom: 24, overflow: "hidden" }}>
          <div
            style={{
              padding: "26px 28px",
              background:
                "linear-gradient(135deg, rgba(17,26,17,0.95) 0%, rgba(45,66,45,0.92) 45%, rgba(143,168,143,0.78) 100%)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: 20,
                alignItems: "flex-end",
              }}
            >
              <div style={{ minWidth: 260, maxWidth: 640 }}>
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 10,
                    color: CREAM[200],
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 8,
                  }}
                >
                  Workspace Overview
                </div>
                <h1
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 38,
                    lineHeight: 1,
                    color: CREAM[50],
                    margin: 0,
                  }}
                >
                  {projectName || "Workspace"}
                </h1>
                <p
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 14,
                    color: CREAM[200],
                    margin: "10px 0 0",
                    lineHeight: 1.6,
                  }}
                >
                  {projectDescription || "Your data workspace"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button size="sm" onClick={() => onNavigate("explorations")}>
                  New Exploration
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onNavigate("connections")}>
                  Manage Connections
                </Button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 20, flexWrap: "wrap" }}>
              <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: CREAM[200] }}>
                {connectedCount} connected sources
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: CREAM[200] }}>
                {savedQueries.length} saved queries
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: CREAM[200] }}>
                {explorations.length} explorations
              </span>
            </div>
          </div>
        </Card>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
            marginBottom: 20,
            opacity: loading ? 0.55 : 1,
            transition: "opacity 0.2s ease",
          }}
        >
          {statItems.map((stat) => (
            <Card key={stat.label} style={{ padding: 18, borderTop: `2px solid ${stat.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: SAGE[400],
                      marginBottom: 8,
                    }}
                  >
                    {stat.label}
                  </div>
                  <div style={{ fontFamily: FONTS.display, fontSize: 32, color: SAGE[900] }}>
                    {stat.value}
                  </div>
                </div>
                <stat.icon size={18} color={stat.color} strokeWidth={1.5} />
              </div>
            </Card>
          ))}
        </div>

        {stats && (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: 13,
                fontWeight: 600,
                color: SAGE[700],
                marginBottom: 10,
              }}
            >
              Live Database Overview
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
              <Card style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Rows3 size={15} color={SAGE[500]} />
                  <span style={{ fontFamily: FONTS.body, fontSize: 11, color: SAGE[500] }}>Tables</span>
                </div>
                <div style={{ fontFamily: FONTS.display, fontSize: 24, color: SAGE[900], marginTop: 8 }}>
                  {stats.table_count}
                </div>
              </Card>
              <Card style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Activity size={15} color={SAGE[500]} />
                  <span style={{ fontFamily: FONTS.body, fontSize: 11, color: SAGE[500] }}>Total Rows</span>
                </div>
                <div style={{ fontFamily: FONTS.display, fontSize: 24, color: SAGE[900], marginTop: 8 }}>
                  {stats.total_row_count.toLocaleString()}
                </div>
              </Card>
              <Card style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <HardDrive size={15} color={SAGE[500]} />
                  <span style={{ fontFamily: FONTS.body, fontSize: 11, color: SAGE[500] }}>Disk Usage</span>
                </div>
                <div style={{ fontFamily: FONTS.display, fontSize: 24, color: SAGE[900], marginTop: 8 }}>
                  {formatBytes(stats.disk_usage_bytes)}
                </div>
              </Card>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          <Card style={{ padding: 0 }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${SAGE[100]}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: SAGE[900] }}>
                Recent Explorations
              </span>
              <button
                onClick={() => onNavigate("explorations")}
                style={{ border: "none", background: "none", cursor: "pointer", fontFamily: FONTS.body, fontSize: 12, color: SAGE[500], display: "flex", alignItems: "center", gap: 4 }}
              >
                Open <ArrowRight size={12} />
              </button>
            </div>
            {recentExplorations.length === 0 ? (
              <div style={{ padding: 18, fontFamily: FONTS.body, fontSize: 13, color: SAGE[400] }}>
                No explorations yet
              </div>
            ) : (
              recentExplorations.map((exp, i) => (
                <div
                  key={exp.id}
                  style={{
                    padding: "12px 16px",
                    borderBottom: i < recentExplorations.length - 1 ? `1px solid ${SAGE[50]}` : "none",
                    cursor: "pointer",
                  }}
                  onClick={() => onNavigate("explorations")}
                >
                  <div style={{ fontFamily: FONTS.body, fontSize: 14, color: SAGE[900] }}>{exp.title}</div>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[400], marginTop: 4 }}>
                    {exp.message_count} messages
                  </div>
                </div>
              ))
            )}
          </Card>

          <Card style={{ padding: 0 }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${SAGE[100]}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: SAGE[900] }}>
                Data Sources
              </span>
              <button
                onClick={() => onNavigate("connections")}
                style={{ border: "none", background: "none", cursor: "pointer", fontFamily: FONTS.body, fontSize: 12, color: SAGE[500], display: "flex", alignItems: "center", gap: 4 }}
              >
                Manage <ArrowRight size={12} />
              </button>
            </div>
            {connections.length === 0 ? (
              <div style={{ padding: 18, fontFamily: FONTS.body, fontSize: 13, color: SAGE[400] }}>
                No connections linked yet
              </div>
            ) : (
              connections.map((conn, i) => (
                <div
                  key={conn.id}
                  style={{
                    padding: "12px 16px",
                    borderBottom: i < connections.length - 1 ? `1px solid ${SAGE[50]}` : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Database size={15} color={conn.connected ? SAGE[500] : SAGE[300]} />
                    <div>
                      <div style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[900] }}>{conn.name}</div>
                      <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[400] }}>{conn.db_type}</div>
                    </div>
                  </div>
                  <Badge variant={conn.connected ? "success" : "default"}>
                    {conn.connected ? "Connected" : "Disconnected"}
                  </Badge>
                </div>
              ))
            )}
          </Card>
        </div>

        <Card style={{ padding: 0, marginTop: 16 }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${SAGE[100]}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: SAGE[900] }}>
              Saved Query Highlights
            </span>
            <button
              onClick={() => onNavigate("queries")}
              style={{ border: "none", background: "none", cursor: "pointer", fontFamily: FONTS.body, fontSize: 12, color: SAGE[500], display: "flex", alignItems: "center", gap: 4 }}
            >
              Open Library <ArrowRight size={12} />
            </button>
          </div>
          {recentQueries.length === 0 ? (
            <div style={{ padding: 18, fontFamily: FONTS.body, fontSize: 13, color: SAGE[400] }}>
              No saved queries in this workspace
            </div>
          ) : (
            recentQueries.map((query, i) => (
              <div
                key={query.id}
                style={{
                  padding: "12px 16px",
                  borderBottom: i < recentQueries.length - 1 ? `1px solid ${SAGE[50]}` : "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[900], overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {query.name}
                  </div>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[400] }}>
                    {query.connection_id}
                  </div>
                </div>
                <BookOpen size={14} color={SAGE[500]} />
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
