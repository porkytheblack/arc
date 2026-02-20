import { useState, useEffect } from "react";
import { SAGE, CREAM, FONTS } from "../lib/theme";
import { listProjects, createProject } from "../lib/commands";
import type { Project } from "../lib/commands";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Plus, FolderOpen, Search } from "lucide-react";
import { TitleBar } from "../components/TitleBar";

interface ProjectSelectProps {
  onSelect: (project: Project) => void;
}

export function ProjectSelect({ onSelect }: ProjectSelectProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listProjects()
      .then((p) => {
        setProjects(p);
        setLoading(false);
        setTimeout(() => setVisible(true), 50);
      })
      .catch(() => {
        setLoading(false);
        setTimeout(() => setVisible(true), 50);
      });
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const project = await createProject(newName.trim(), newDesc.trim());
      onSelect(project);
    } catch {
      setCreating(false);
    }
  };

  const query = search.trim().toLowerCase();
  const filtered = query
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query),
      )
    : projects;

  if (loading) {
    return (
      <div
        style={{
          width: "100%",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TitleBar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  background: SAGE[300],
                  borderRadius: "50%",
                  animation: `typingDot 1.2s ease-in-out ${i * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: CREAM[100],
        display: "flex",
        flexDirection: "column",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.35s ease",
      }}
    >
      <TitleBar />
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
        }}
      >
      <div
        style={{
          width: 480,
          maxHeight: "calc(100vh - 80px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Logo and header */}
        <div style={{ textAlign: "center", marginBottom: 40, flexShrink: 0 }}>
          <img
            src="/arc-logo.png"
            alt="Arc"
            style={{
              width: 48,
              height: 48,
              objectFit: "contain",
              marginBottom: 16,
            }}
          />
          <h1
            style={{
              fontFamily: FONTS.display,
              fontSize: 32,
              fontWeight: 400,
              color: SAGE[900],
              margin: 0,
              marginBottom: 8,
            }}
          >
            Arc
          </h1>
          <p
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              color: SAGE[500],
              margin: 0,
            }}
          >
            Select a project to continue
          </p>
        </div>

        {/* Search - shown when 8+ projects */}
        {!showCreate && projects.length >= 8 && (
          <div style={{ flexShrink: 0, marginBottom: 12, position: "relative" }}>
            <Search
              size={14}
              color={SAGE[300]}
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setSearch(""); }}
              placeholder="Search projects..."
              aria-label="Search projects"
              style={{
                width: "100%",
                padding: "10px 12px 10px 34px",
                fontFamily: FONTS.body,
                fontSize: 13,
                color: SAGE[900],
                background: CREAM[50],
                border: `1px solid ${SAGE[100]}`,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {/* Project list */}
        {!showCreate && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {filtered.length === 0 && query ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  fontFamily: FONTS.body,
                  fontSize: 13,
                  color: SAGE[400],
                }}
              >
                No projects match "{search.trim()}"
              </div>
            ) : (
              filtered.map((project, idx) => (
                <button
                  key={project.id}
                  onClick={() => onSelect(project)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "16px 20px",
                    background: CREAM[50],
                    border: `1px solid ${SAGE[100]}`,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    textAlign: "left",
                    flexShrink: 0,
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateY(0)" : "translateY(8px)",
                    transitionDelay: `${Math.min(idx, 8) * 0.05}s`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = SAGE[300];
                    e.currentTarget.style.background = CREAM[50];
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = SAGE[100];
                    e.currentTarget.style.background = CREAM[50];
                  }}
                >
                  <FolderOpen size={20} color={SAGE[500]} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: FONTS.body,
                        fontSize: 15,
                        fontWeight: 500,
                        color: SAGE[900],
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {project.name}
                    </span>
                    <span
                      style={{
                        fontFamily: FONTS.body,
                        fontSize: 12,
                        color: SAGE[500],
                        display: "block",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {project.description}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    <span
                      style={{
                        fontFamily: FONTS.mono,
                        fontSize: 10,
                        color: SAGE[400],
                      }}
                    >
                      {project.connections.length} connections
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Create new project form */}
        {showCreate && (
          <div
            style={{
              background: CREAM[50],
              border: `1px solid ${SAGE[100]}`,
              padding: 24,
              marginBottom: 16,
              animation: "slideUp 0.25s ease",
            }}
          >
            <h3
              style={{
                fontFamily: FONTS.body,
                fontSize: 14,
                fontWeight: 600,
                color: SAGE[900],
                margin: "0 0 16px",
              }}
            >
              New Project
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Input
                label="Project Name"
                value={newName}
                onChange={setNewName}
                placeholder="My Analysis Project"
              />
              <Input
                label="Description"
                value={newDesc}
                onChange={setNewDesc}
                placeholder="What will you be exploring?"
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <Button size="sm" onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? "Creating..." : "Create Project"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* New project button */}
        {!showCreate && (
          <div style={{ flexShrink: 0, display: "flex", justifyContent: "center" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={12} /> New Project
            </Button>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 48,
            gap: 6,
            alignItems: "center",
            flexShrink: 0,
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
    </div>
  );
}
