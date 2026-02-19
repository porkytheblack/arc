import { useState, useEffect } from "react";
import { SAGE, CREAM, FONTS } from "../lib/theme";
import { listProjects, createProject } from "../lib/commands";
import type { Project } from "../lib/commands";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Plus, FolderOpen } from "lucide-react";

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

  if (loading) {
    return (
      <div
        style={{
          width: "100%",
          height: "100vh",
          background: CREAM[100],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
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
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: CREAM[100],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.35s ease",
      }}
    >
      <div
        style={{
          width: 480,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Logo and header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              width: 48,
              height: 48,
              background: SAGE[900],
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontFamily: FONTS.display,
                fontSize: 24,
                color: CREAM[50],
                lineHeight: 1,
              }}
            >
              A
            </span>
          </div>
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

        {/* Project list */}
        {!showCreate && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {projects.map((project, idx) => (
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
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(8px)",
                  transitionDelay: `${idx * 0.05}s`,
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
                <div style={{ flex: 1 }}>
                  <span
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 15,
                      fontWeight: 500,
                      color: SAGE[900],
                      display: "block",
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
                    }}
                  >
                    {project.description}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
            ))}
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowCreate(true)}
            style={{ alignSelf: "center" }}
          >
            <Plus size={12} /> New Project
          </Button>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 48,
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
