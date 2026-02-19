import { useState } from "react";
import { SAGE, CREAM, FONTS } from "../lib/theme";
import {
  Home,
  MessageSquare,
  BarChart3,
  BookOpen,
  Database,
  Settings,
  Search,
  Link,
  FolderOpen,
  Table2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  id: string;
  icon: LucideIcon;
  label: string;
}

interface NavButtonProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}

export interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onSwitchProject?: () => void;
}

const NAV_ITEMS: NavItem[] = [
  { id: "home", icon: Home, label: "Home" },
  { id: "explorations", icon: MessageSquare, label: "Explorations" },
  { id: "charts", icon: BarChart3, label: "Charts" },
  { id: "queries", icon: BookOpen, label: "Queries" },
  { id: "scanner", icon: Search, label: "Query Scanner" },
  { id: "links", icon: Link, label: "Table Links" },
  { id: "schema", icon: Table2, label: "Schema" },
];

const BOTTOM_ITEMS: NavItem[] = [
  { id: "connections", icon: Database, label: "Connections" },
  { id: "settings", icon: Settings, label: "Settings" },
];

function NavButton({ icon: Icon, label, active, onClick }: NavButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      style={{
        width: 40,
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? SAGE[100] : hovered ? SAGE[50] : "transparent",
        border: "none",
        cursor: "pointer",
        transition: "all 0.2s ease",
        position: "relative",
      }}
    >
      <Icon
        size={18}
        color={active ? SAGE[900] : hovered ? SAGE[700] : SAGE[400]}
        strokeWidth={active ? 2 : 1.5}
      />
      {active && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 8,
            bottom: 8,
            width: 2,
            background: SAGE[900],
          }}
        />
      )}
    </button>
  );
}

export function Sidebar({ activeView, onNavigate, onSwitchProject }: SidebarProps) {
  return (
    <div
      style={{
        width: 56,
        height: "100%",
        background: CREAM[50],
        borderRight: `1px solid ${SAGE[100]}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 12,
        paddingBottom: 12,
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 32,
          height: 32,
          background: SAGE[900],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.display,
            fontSize: 16,
            color: CREAM[50],
            lineHeight: 1,
          }}
        >
          A
        </span>
      </div>

      {/* Switch project */}
      {onSwitchProject && (
        <div style={{ marginBottom: 12 }}>
          <NavButton
            icon={FolderOpen}
            label="Switch Project"
            active={false}
            onClick={onSwitchProject}
          />
        </div>
      )}

      {/* Main nav */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeView === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </div>

      {/* Bottom nav */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {BOTTOM_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeView === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
