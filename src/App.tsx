import { useEffect, useState } from "react";
import { CREAM } from "./lib/theme";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { WorkspaceHome } from "./views/WorkspaceHome";
import { Explorations } from "./views/Explorations";
import { Charts } from "./views/Charts";
import { QueryLibrary } from "./views/QueryLibrary";
import { Connections } from "./views/Connections";
import { Settings } from "./views/Settings";
import { ProjectSelect } from "./views/ProjectSelect";
import { QueryScanner } from "./views/QueryScanner";
import { TableLinks } from "./views/TableLinks";
import { SchemaViewer } from "./views/SchemaViewer";
import { Button } from "./components/Button";
import type { Project } from "./lib/commands";
import "./styles.css";

type ViewId = "home" | "explorations" | "charts" | "queries" | "connections" | "settings" | "scanner" | "links" | "schema";

interface ViewConfig {
  title: string;
  subtitle: string;
}

const VIEW_CONFIG: Record<ViewId, ViewConfig> = {
  home: { title: "Arc", subtitle: "Workspace" },
  explorations: { title: "Explorations", subtitle: "Conversation threads" },
  charts: { title: "Charts", subtitle: "Data visualizations" },
  queries: { title: "Query Library", subtitle: "Saved queries" },
  scanner: { title: "Query Scanner", subtitle: "Find SQL in your codebase" },
  links: { title: "Table Links", subtitle: "Table relationships" },
  schema: { title: "Schema", subtitle: "Database tables" },
  connections: { title: "Connections", subtitle: "Database management" },
  settings: { title: "Settings", subtitle: "App configuration" },
};

export default function App() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeView, setActiveView] = useState<ViewId>("home");
  const [keepExplorationsMounted, setKeepExplorationsMounted] = useState(false);

  useEffect(() => {
    if (activeView === "explorations") {
      setKeepExplorationsMounted(true);
    }
  }, [activeView]);
  const showExplorations = activeView === "explorations" || keepExplorationsMounted;

  const navigateTo = (view: string) => {
    setActiveView(view as ViewId);
  };

  // Show project selection screen first
  if (!selectedProject) {
    return <ProjectSelect onSelect={setSelectedProject} />;
  }

  const config = VIEW_CONFIG[activeView] || VIEW_CONFIG.home;
  const headerSubtitle = activeView === "home" ? selectedProject.name : config.subtitle;

  const renderNonExplorationView = () => {
    switch (activeView) {
      case "home":
        return (
          <WorkspaceHome
            onNavigate={navigateTo}
            projectId={selectedProject.id}
            projectName={selectedProject.name}
            projectDescription={selectedProject.description}
          />
        );
      case "charts":
        return <Charts />;
      case "queries":
        return <QueryLibrary />;
      case "scanner":
        return <QueryScanner />;
      case "links":
        return <TableLinks />;
      case "schema":
        return <SchemaViewer />;
      case "connections":
        return <Connections projectId={selectedProject.id} />;
      case "settings":
        return <Settings />;
      default:
        return (
          <WorkspaceHome
            onNavigate={navigateTo}
            projectId={selectedProject.id}
            projectName={selectedProject.name}
            projectDescription={selectedProject.description}
          />
        );
    }
  };

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100vh",
        background: CREAM[100],
        overflow: "hidden",
      }}
    >
      <Sidebar
        activeView={activeView}
        onNavigate={navigateTo}
        onSwitchProject={() => {
          setSelectedProject(null);
          setKeepExplorationsMounted(false);
          setActiveView("home");
        }}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Header
          title={config.title}
          subtitle={headerSubtitle}
          actions={
            activeView === "home" ? (
              <Button size="sm" variant="secondary" onClick={() => navigateTo("connections")}>
                Schema
              </Button>
            ) : null
          }
        />
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex" }}>
          {showExplorations && (
            <div
              style={{
                display: activeView === "explorations" ? "flex" : "none",
                flex: 1,
                minHeight: 0,
              }}
            >
              <Explorations
                projectId={selectedProject.id}
                projectName={selectedProject.name}
                projectDescription={selectedProject.description}
              />
            </div>
          )}
          {activeView !== "explorations" && (
            <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
              {renderNonExplorationView()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
