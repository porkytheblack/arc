import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { SAGE, CREAM, FONTS, SEMANTIC } from "../lib/theme";
import {
  listExplorations,
  createExploration,
  deleteExploration,
  updateExploration,
  listProjectConnections,
  autoConnectProjectConnections,
  listSavedQueries,
  listConnectionNotes,
} from "../lib/commands";
import type {
  Exploration as ExplorationData,
  DatabaseConnection,
  SavedQuery,
  ConnectionNote,
} from "../lib/commands";
import { GloveProvider, Render, useGlove } from "glove-react";
import type { TimelineEntry } from "glove-react";
import { createArcClient } from "../lib/glove-client";
import type { ProjectContext } from "../lib/glove-client";
import {
  extractSavedQueryParams,
  findSavedQueryByReference,
  slashAliasForSavedQuery,
  type SavedQueryParamValue,
} from "../lib/saved-query-utils";
import { Plus, Send, Trash2, Search } from "lucide-react";
import { SendMessageProvider } from "../lib/send-message-context";
import { Select } from "../components/Select";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const AUTO_CONNECT_ATTEMPTED = new Set<string>();
const COMPACTION_MESSAGE_PREFIX = "[Conversation summary from compaction]";
const ACTIVE_CONNECTION_STORAGE_PREFIX = "arc.active_connection_by_exploration";

function isCompactionMessageText(text: string): boolean {
  return text.trimStart().startsWith(COMPACTION_MESSAGE_PREFIX);
}

function isCompactionTimelineEntry(entry: TimelineEntry): boolean {
  const withCompaction = entry as TimelineEntry & { is_compaction?: boolean };
  if (withCompaction.is_compaction === true) {
    return true;
  }
  if (entry.kind === "user" || entry.kind === "agent_text") {
    return isCompactionMessageText(entry.text);
  }
  return false;
}

interface SavedQuerySlashCommand {
  reference: string;
  params: Record<string, SavedQueryParamValue>;
  invalidTokens: string[];
}

function tokenizeSlashInput(raw: string): string[] {
  const matches = raw.match(/"[^"]*"|'[^']*'|[^\s]+/g);
  return matches ? matches : [];
}

function parseParamValue(rawValue: string): SavedQueryParamValue {
  const trimmed = rawValue.trim();
  const unquoted = (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) ? trimmed.slice(1, -1) : trimmed;

  const lower = unquoted.toLowerCase();
  if (lower === "null") return null;
  if (lower === "true") return true;
  if (lower === "false") return false;

  const asNumber = Number(unquoted);
  if (unquoted !== "" && Number.isFinite(asNumber) && /^-?\d+(\.\d+)?$/.test(unquoted)) {
    return asNumber;
  }

  return unquoted;
}

function parseSavedQuerySlashCommand(text: string): SavedQuerySlashCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/") || trimmed.length < 2) return null;

  const tokens = tokenizeSlashInput(trimmed);
  if (tokens.length === 0) return null;

  const reference = tokens[0].replace(/^\/+/, "");
  if (!reference) return null;

  const params: Record<string, SavedQueryParamValue> = {};
  const invalidTokens: string[] = [];
  let positionalIndex = 1;

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    const eqIndex = token.indexOf("=");
    if (eqIndex > 0) {
      const key = token.slice(0, eqIndex).trim();
      const value = token.slice(eqIndex + 1).trim();
      if (!key || !value) {
        invalidTokens.push(token);
        continue;
      }
      params[key] = parseParamValue(value);
      continue;
    }

    if (token.startsWith("=")) {
      invalidTokens.push(token);
      continue;
    }

    params[`param${positionalIndex}`] = parseParamValue(token);
    positionalIndex += 1;
  }

  return { reference, params, invalidTokens };
}

// --- Typing Indicator ---

function TypingIndicator({ showAvatar = true }: { showAvatar?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        marginBottom: 24,
      }}
    >
      {showAvatar ? (
        <img
          src="/arc-logo.png"
          alt="Arc"
          style={{
            width: 28,
            height: 28,
            objectFit: "contain",
            flexShrink: 0,
          }}
        />
      ) : (
        <div style={{ width: 28, flexShrink: 0 }} />
      )}
      <div style={{ display: "flex", gap: 4, padding: "12px 0" }}>
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

// --- Timeline Entry Renderers ---

function UserBubble({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: 16,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "all 0.35s ease",
      }}
    >
      <div
        style={{
          background: SAGE[900],
          color: CREAM[50],
          padding: "10px 16px",
          maxWidth: "75%",
          fontFamily: FONTS.body,
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <img
      src="/arc-logo.png"
      alt="Arc"
      style={{
        width: 28,
        height: 28,
        objectFit: "contain",
        flexShrink: 0,
        marginTop: 2,
      }}
    />
  );
}

function AvatarSpacer() {
  return <div style={{ width: 28, flexShrink: 0 }} />;
}

function AgentTextBubble({
  text,
  showAvatar = true,
  spacing = 24,
}: {
  text: string;
  showAvatar?: boolean;
  spacing?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        marginBottom: spacing,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "all 0.35s ease",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        {showAvatar ? <BotAvatar /> : <AvatarSpacer />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              lineHeight: 1.7,
              color: SAGE[800],
              margin: 0,
              wordBreak: "break-word",
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p style={{ margin: "0 0 10px", lineHeight: 1.7 }}>{children}</p>
                ),
                ul: ({ children }) => (
                  <ul style={{ margin: "0 0 10px 18px", lineHeight: 1.7 }}>{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol style={{ margin: "0 0 10px 18px", lineHeight: 1.7 }}>{children}</ol>
                ),
                li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                code: ({ className, children }) => {
                  const isBlock = Boolean(className && className.includes("language-"));
                  if (!isBlock) {
                    return (
                      <code
                        style={{
                          fontFamily: FONTS.mono,
                          fontSize: 12,
                          background: SAGE[100],
                          color: SAGE[900],
                          padding: "1px 4px",
                        }}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code
                      style={{
                        display: "block",
                        fontFamily: FONTS.mono,
                        fontSize: 12,
                        background: SAGE[50],
                        color: SAGE[900],
                        padding: "10px 12px",
                        overflowX: "auto",
                        lineHeight: 1.6,
                        marginBottom: 10,
                      }}
                    >
                      {children}
                    </code>
                  );
                },
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: SAGE[600], textDecoration: "underline" }}
                  >
                    {children}
                  </a>
                ),
                table: ({ children }) => (
                  <div style={{ overflowX: "auto", marginBottom: 10 }}>
                    <table style={{ borderCollapse: "collapse", width: "100%" }}>{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th
                    style={{
                      border: `1px solid ${SAGE[100]}`,
                      padding: "6px 8px",
                      textAlign: "left",
                      background: CREAM[100],
                    }}
                  >
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td style={{ border: `1px solid ${SAGE[100]}`, padding: "6px 8px" }}>
                    {children}
                  </td>
                ),
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactionNotice({ spacing = 24 }: { spacing?: number }) {
  return (
    <div
      style={{
        marginBottom: spacing,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: SAGE[500],
          background: SAGE[50],
          border: `1px solid ${SAGE[100]}`,
          padding: "6px 10px",
        }}
      >
        Conversation compacted for context window
      </div>
    </div>
  );
}

function isBotTimelineEntry(entry: TimelineEntry | null | undefined): boolean {
  if (!entry) return false;
  return isCompactionTimelineEntry(entry) || entry.kind === "agent_text" || entry.kind === "tool";
}

function getBotEntryLayout(timeline: TimelineEntry[], index: number): { showAvatar: boolean; spacing: number } {
  const prevEntry = index > 0 ? timeline[index - 1] : null;
  const nextEntry = index < timeline.length - 1 ? timeline[index + 1] : null;
  return {
    showAvatar: !isBotTimelineEntry(prevEntry),
    spacing: isBotTimelineEntry(nextEntry) ? 8 : 24,
  };
}

function ToolRunningStatus({
  toolName,
  showAvatar = true,
  spacing = 24,
}: {
  toolName: string;
  showAvatar?: boolean;
  spacing?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 1000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div style={{ marginBottom: spacing }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        {showAvatar ? <BotAvatar /> : <AvatarSpacer />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 0",
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
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: SAGE[400],
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Running {toolName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Conversation Panel (uses Glove hook) ---

function ConversationPanel({
  explorationId,
  savedQueries,
  connections,
  activeConnectionId: selectedConnectionId,
  onActiveConnectionChange,
}: {
  explorationId: string;
  savedQueries: SavedQuery[];
  connections: DatabaseConnection[];
  activeConnectionId: string;
  onActiveConnectionChange: (connectionId: string) => void;
}) {
  const glove = useGlove({ sessionId: explorationId });
  const { timeline, streamingText, busy, slots, sendMessage, abort } = glove;

  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const visibleTimeline = timeline;
  const availableConnections = useMemo(() => {
    const connected = connections.filter((c) => c.connected);
    return connected.length > 0 ? connected : connections;
  }, [connections]);
  const lastSentConnectionIdRef = useRef<string | null>(null);

  const activeConnectionId = useMemo(() => {
    if (availableConnections.length === 0) return "";
    const exists = availableConnections.some((c) => c.id === selectedConnectionId);
    return exists ? selectedConnectionId : availableConnections[0].id;
  }, [availableConnections, selectedConnectionId]);

  useEffect(() => {
    if (activeConnectionId !== selectedConnectionId) {
      onActiveConnectionChange(activeConnectionId);
    }
    if (!activeConnectionId) {
      lastSentConnectionIdRef.current = null;
    }
  }, [activeConnectionId, selectedConnectionId, onActiveConnectionChange]);

  const activeConnection = availableConnections.find((c) => c.id === activeConnectionId) ?? null;

  const withConnectionSwitchPreamble = useCallback(
    (message: string) => {
      if (!activeConnection) return message;
      if (lastSentConnectionIdRef.current == null) {
        lastSentConnectionIdRef.current = activeConnection.id;
        return message;
      }
      if (lastSentConnectionIdRef.current === activeConnection.id) {
        return message;
      }
      lastSentConnectionIdRef.current = activeConnection.id;
      return [
        `Switched connection to "${activeConnection.name}" (id: "${activeConnection.id}").`,
        "Use this connection as the default for subsequent tool calls unless explicitly overridden.",
        "",
        message,
      ].join("\n");
    },
    [activeConnection]
  );

  // Scroll to bottom when timeline changes
  useEffect(() => {
    if (chatRef.current) {
      setTimeout(() => {
        if (chatRef.current) {
          chatRef.current.scrollTo({
            top: chatRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 100);
    }
  }, [visibleTimeline, streamingText, busy, slots]);

  const handleSend = useCallback(() => {
    if (!input.trim() || busy) return;
    const text = input.trim();
    setInput("");
    setInputError(null);

    const slash = parseSavedQuerySlashCommand(text);
    if (slash) {
      const matched = findSavedQueryByReference(savedQueries, slash.reference);
      if (!matched) {
        setInputError(`No saved query found for "/${slash.reference}"`);
        return;
      }

      if (slash.invalidTokens.length > 0) {
        setInputError(
          `Invalid parameter tokens: ${slash.invalidTokens.join(", ")}. Use key=value format.`
        );
        return;
      }

      const requiredParams = extractSavedQueryParams(matched.sql);
      const providedKeys = Object.keys(slash.params).map((k) => k.toLowerCase());
      const missing = requiredParams.filter((param) => !providedKeys.includes(param.toLowerCase()));
      if (missing.length > 0) {
        setInputError(
          `Missing required params for "${matched.name}": ${missing.join(", ")}`
        );
        return;
      }

      const syntheticPrompt = [
        `User invoked saved query "/${slash.reference}".`,
        `Call execute_saved_query with queryRef "${matched.id}" and params ${JSON.stringify(slash.params)}.`,
        "After the tool finishes, give only a short follow-up sentence.",
      ].join("\n");
      sendMessage(withConnectionSwitchPreamble(syntheticPrompt));
      return;
    }

    sendMessage(withConnectionSwitchPreamble(text));
  }, [input, busy, sendMessage, savedQueries, withConnectionSwitchPreamble]);

  const handleAbort = useCallback(() => {
    if (!busy) return;
    abort();
  }, [busy, abort]);

  return (
    <SendMessageProvider value={sendMessage}>
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: CREAM[100],
      }}
    >
      {availableConnections.length > 1 && (
        <div
          style={{
            borderBottom: `1px solid ${SAGE[100]}`,
            background: CREAM[50],
            padding: "8px 24px",
          }}
        >
          <div
            style={{
              maxWidth: 720,
              margin: "0 auto",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 10,
                color: SAGE[400],
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              Connection
            </span>
            <Select
              value={activeConnectionId}
              onChange={onActiveConnectionChange}
              disabled={busy}
              minWidth={210}
              options={availableConnections.map((conn) => ({
                value: conn.id,
                label: `${conn.name} (${conn.id})`,
              }))}
            />
          </div>
        </div>
      )}

      {/* Chat messages */}
      <div
        ref={chatRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 24px 0",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {visibleTimeline.length === 0 && !busy && (
            <AgentTextBubble text="Welcome to this exploration. I have access to your connected databases. What would you like to explore? Try asking me to show the schema, run a query, or view database stats." />
          )}

          <Render
            glove={glove}
            strategy="interleaved"
            renderInput={() => null}
            renderMessage={({ entry, index }) => {
              const isCompactionEntry = isCompactionTimelineEntry(entry);
              if (isCompactionEntry) {
                const { spacing } = getBotEntryLayout(visibleTimeline, index);
                return <CompactionNotice spacing={spacing} />;
              }

              if (entry.kind === "user") {
                return <UserBubble text={entry.text} />;
              }

              const { showAvatar, spacing } = getBotEntryLayout(visibleTimeline, index);
              return (
                <AgentTextBubble
                  text={entry.text}
                  showAvatar={showAvatar}
                  spacing={spacing}
                />
              );
            }}
            renderToolStatus={({ entry, index, hasSlot }) => {
              const { showAvatar, spacing } = getBotEntryLayout(visibleTimeline, index);

              if (entry.status === "running" && !hasSlot) {
                return (
                  <ToolRunningStatus
                    toolName={entry.name}
                    showAvatar={showAvatar}
                    spacing={spacing}
                  />
                );
              }

              const fallbackOutput =
                entry.output && !/^\s*\[object Object\]\s*$/.test(entry.output)
                  ? entry.output
                  : null;

              if (
                entry.status !== "running" &&
                !hasSlot &&
                entry.renderData === undefined &&
                fallbackOutput
              ) {
                return (
                  <AgentTextBubble
                    text={fallbackOutput}
                    showAvatar={showAvatar}
                    spacing={spacing}
                  />
                );
              }

              return null;
            }}
            renderStreaming={({ text }) => (
              <AgentTextBubble
                text={text}
                showAvatar={!isBotTimelineEntry(visibleTimeline[visibleTimeline.length - 1])}
                spacing={24}
              />
            )}
          />

          {busy &&
            !streamingText &&
            !timeline.some(
              (e) => e.kind === "tool" && e.status === "running"
            ) && (
              <TypingIndicator
                showAvatar={
                  visibleTimeline.length === 0 ||
                  (!isCompactionTimelineEntry(visibleTimeline[visibleTimeline.length - 1]) &&
                    visibleTimeline[visibleTimeline.length - 1].kind === "user")
                }
              />
            )}
        </div>
      </div>

      {/* Input bar */}
      <div
        style={{
          padding: "16px 24px",
          borderTop: `1px solid ${SAGE[100]}`,
          background: CREAM[50],
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder='Ask about your data... or run "/query-alias key=value"'
              disabled={busy}
              style={{
                flex: 1,
                padding: "12px 16px",
                border: `1px solid ${SAGE[200]}`,
                background: CREAM[50],
                fontFamily: FONTS.body,
                fontSize: 14,
                color: SAGE[900],
                outline: "none",
                transition: "border-color 0.2s ease",
                opacity: busy ? 0.6 : 1,
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = SAGE[500])
              }
              onBlur={(e) =>
                (e.target.style.borderColor = SAGE[200])
              }
            />
            <button
              onClick={busy ? handleAbort : handleSend}
              disabled={!busy && !input.trim()}
              title={busy ? "Abort current request" : "Send message"}
              style={{
                padding: "12px 20px",
                background: busy ? SEMANTIC.error : SAGE[900],
                color: SAGE[50],
                border: "none",
                cursor: (!busy && !input.trim()) ? "not-allowed" : "pointer",
                transition: "background 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 52,
                opacity: (!busy && !input.trim()) ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!busy && input.trim())
                  e.currentTarget.style.background = SAGE[700];
                if (busy) e.currentTarget.style.background = SEMANTIC.error;
              }}
              onMouseLeave={(e) => {
                if (!busy)
                  e.currentTarget.style.background = SAGE[900];
                if (busy) e.currentTarget.style.background = SEMANTIC.error;
              }}
            >
              {busy ? (
                <span
                  style={{
                    width: 10,
                    height: 10,
                    background: SAGE[50],
                    display: "block",
                  }}
                />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          {inputError && (
            <div
              style={{
                marginTop: 8,
                fontFamily: FONTS.body,
                fontSize: 12,
                color: SEMANTIC.error,
              }}
            >
              {inputError}
            </div>
          )}
          {/* POWERED BY footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 10,
              gap: 6,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 9,
                color: SAGE[300],
                letterSpacing: "0.1em",
              }}
            >
              POWERED BY
            </span>
            <span
              style={{
                fontFamily: FONTS.display,
                fontSize: 12,
                color: SAGE[500],
              }}
            >
              Glove
            </span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 9,
                color: SAGE[300],
              }}
            >
              {"\u00B7"}
            </span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 9,
                color: SAGE[300],
                letterSpacing: "0.05em",
              }}
            >
              dterminal.net
            </span>
          </div>
        </div>
      </div>
    </div>
    </SendMessageProvider>
  );
}

// --- Main Explorations View ---

export function Explorations({
  projectId,
  projectName,
  projectDescription,
}: {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
}) {
  const currentProjectId = projectId || "proj-1";
  const [explorations, setExplorations] = useState<ExplorationData[]>([]);
  const [selectedExp, setSelectedExp] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [connectionNotes, setConnectionNotes] = useState<ConnectionNote[]>([]);
  const [activeConnectionByExploration, setActiveConnectionByExploration] = useState<Record<string, string>>({});
  const [activeConnectionMapHydrated, setActiveConnectionMapHydrated] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const activeConnectionStorageKey = `${ACTIVE_CONNECTION_STORAGE_PREFIX}:${currentProjectId}`;

  // Load explorations and connections immediately, auto-connect in background
  useEffect(() => {
    // Reset state for the new project
    setSelectedExp("");
    setExplorations([]);
    setConnections([]);
    setSavedQueries([]);
    setConnectionNotes([]);
    setActiveConnectionByExploration({});
    setActiveConnectionMapHydrated(false);
    setLoading(true);

    const load = async () => {
      try {
        const [exps, conns, queries, notes] = await Promise.all([
          listExplorations(currentProjectId),
          listProjectConnections(currentProjectId),
          listSavedQueries(),
          listConnectionNotes(),
        ]);
        // Scope saved queries to this project's connections
        const connIds = new Set(conns.map((c) => c.id));
        setExplorations(exps);
        setConnections(conns);
        setSavedQueries(queries.filter((q) => connIds.has(q.connection_id)));
        setConnectionNotes(notes);
        if (exps.length > 0) {
          setSelectedExp(exps[0].id);
        }
      } catch {
        // load failed
      }
      setLoading(false);
    };
    load();

    // Auto-connect in background once per project per app session.
    if (!AUTO_CONNECT_ATTEMPTED.has(currentProjectId)) {
      AUTO_CONNECT_ATTEMPTED.add(currentProjectId);
      autoConnectProjectConnections(currentProjectId)
        .then((connectedIds) => {
          if (connectedIds.length > 0) {
            listProjectConnections(currentProjectId).then(setConnections).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, [currentProjectId]);

  const refreshConnectionNotes = useCallback(async () => {
    try {
      const notes = await listConnectionNotes();
      setConnectionNotes(notes);
    } catch {
      // ignore note refresh errors
    }
  }, []);

  useEffect(() => {
    const onNotesUpdated = () => {
      void refreshConnectionNotes();
    };
    window.addEventListener("arc:notes-updated", onNotesUpdated);
    return () => {
      window.removeEventListener("arc:notes-updated", onNotesUpdated);
    };
  }, [refreshConnectionNotes]);

  useEffect(() => {
    setActiveConnectionMapHydrated(false);
    if (typeof window === "undefined") {
      setActiveConnectionByExploration({});
      setActiveConnectionMapHydrated(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(activeConnectionStorageKey);
      if (!raw) {
        setActiveConnectionByExploration({});
      } else {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          setActiveConnectionByExploration({});
        } else {
          const hydrated: Record<string, string> = {};
          for (const [expId, connId] of Object.entries(parsed)) {
            if (typeof connId === "string" && connId.length > 0) {
              hydrated[expId] = connId;
            }
          }
          setActiveConnectionByExploration(hydrated);
        }
      }
    } catch {
      setActiveConnectionByExploration({});
    } finally {
      setActiveConnectionMapHydrated(true);
    }
  }, [activeConnectionStorageKey]);

  useEffect(() => {
    if (!activeConnectionMapHydrated || typeof window === "undefined") return;
    try {
      if (Object.keys(activeConnectionByExploration).length === 0) {
        window.localStorage.removeItem(activeConnectionStorageKey);
      } else {
        window.localStorage.setItem(
          activeConnectionStorageKey,
          JSON.stringify(activeConnectionByExploration)
        );
      }
    } catch {
      // ignore local storage write errors
    }
  }, [activeConnectionStorageKey, activeConnectionByExploration, activeConnectionMapHydrated]);

  useEffect(() => {
    if (loading || !activeConnectionMapHydrated) return;
    const validConnectionIds = new Set(connections.map((c) => c.id));
    setActiveConnectionByExploration((prev) => {
      let changed = false;
      const next: Record<string, string> = {};
      for (const [expId, connId] of Object.entries(prev)) {
        if (validConnectionIds.has(connId)) {
          next[expId] = connId;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [connections, loading, activeConnectionMapHydrated]);

  useEffect(() => {
    if (loading || !activeConnectionMapHydrated) return;
    const validExplorationIds = new Set(explorations.map((e) => e.id));
    setActiveConnectionByExploration((prev) => {
      let changed = false;
      const next: Record<string, string> = {};
      for (const [expId, connId] of Object.entries(prev)) {
        if (validExplorationIds.has(expId)) {
          next[expId] = connId;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [explorations, loading, activeConnectionMapHydrated]);

  const selectedExplorationActiveConnectionId = useMemo(() => {
    if (!selectedExp) return "";
    const preferred = activeConnectionByExploration[selectedExp];
    if (preferred && connections.some((c) => c.id === preferred)) {
      return preferred;
    }
    const connected = connections.find((c) => c.connected);
    return connected?.id || connections[0]?.id || "";
  }, [selectedExp, activeConnectionByExploration, connections]);

  const handleActiveConnectionChange = useCallback((connectionId: string) => {
    if (!selectedExp) return;
    setActiveConnectionByExploration((prev) => {
      if (prev[selectedExp] === connectionId) return prev;
      return { ...prev, [selectedExp]: connectionId };
    });
  }, [selectedExp]);

  // Build context-aware client whenever connections change
  const arcClient = useMemo(() => {
    const connectionIds = new Set(connections.map((c) => c.id));
    const contextualSavedQueries = savedQueries
      .filter((q) => connectionIds.has(q.connection_id))
      .map((q) => ({
        id: q.id,
        name: q.name,
        description: q.description,
        sql: q.sql,
        connection_id: q.connection_id,
        params: extractSavedQueryParams(q.sql),
        slashAlias: slashAliasForSavedQuery(q),
      }));

    const context: ProjectContext = {
      projectName: projectName || "Default Project",
      projectDescription: projectDescription || "",
      connections: connections.map((c) => ({
        id: c.id,
        name: c.name,
        db_type: c.db_type,
        database: c.database,
        connected: c.connected,
      })),
      activeConnectionId: selectedExplorationActiveConnectionId,
      connectionNotes: connectionNotes.filter((n) => connectionIds.has(n.connection_id)),
      savedQueries: contextualSavedQueries,
    };
    return createArcClient(context);
  }, [projectName, projectDescription, connections, selectedExplorationActiveConnectionId, connectionNotes, savedQueries]);

  const handleNewExploration = useCallback(async () => {
    try {
      const exp = await createExploration(
        currentProjectId,
        `Exploration ${explorations.length + 1}`
      );
      setExplorations((prev) => [...prev, exp]);
      setSelectedExp(exp.id);
    } catch {
      // Creation failed; no new exploration appears
    }
  }, [currentProjectId, explorations.length]);

  const handleDeleteExploration = useCallback(
    async (expId: string) => {
      try {
        await deleteExploration(expId);
        setExplorations((prev) => {
          const next = prev.filter((e) => e.id !== expId);
          if (expId === selectedExp && next.length > 0) {
            setSelectedExp(next[0].id);
          } else if (next.length === 0) {
            setSelectedExp("");
          }
          return next;
        });
      } catch {
        // Deletion failed; list remains unchanged
      }
    },
    [selectedExp]
  );

  const handleRename = useCallback(
    async (expId: string, newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed) {
        setEditingId(null);
        return;
      }
      try {
        const updated = await updateExploration(expId, trimmed);
        setExplorations((prev) =>
          prev.map((e) => (e.id === expId ? { ...e, title: updated.title } : e))
        );
      } catch {
        // Rename failed; keep old title
      }
      setEditingId(null);
    },
    []
  );

  const filteredExplorations = useMemo(() => {
    if (!searchQuery.trim()) return explorations;
    const q = searchQuery.toLowerCase();
    return explorations.filter((e) => e.title.toLowerCase().includes(q));
  }, [explorations, searchQuery]);

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* Exploration list sidebar */}
      <div
        style={{
          width: 260,
          borderRight: `1px solid ${SAGE[100]}`,
          background: CREAM[50],
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: "16px",
            borderBottom: `1px solid ${SAGE[100]}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              fontWeight: 600,
              color: SAGE[900],
            }}
          >
            Explorations
          </span>
          <button
            onClick={handleNewExploration}
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: `1px solid ${SAGE[200]}`,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            title="New exploration"
          >
            <Plus size={14} color={SAGE[500]} />
          </button>
        </div>
        {explorations.length > 0 && (
          <div style={{ padding: "8px 8px 0" }}>
            <div style={{ position: "relative" }}>
              <Search
                size={12}
                color={SAGE[300]}
                style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter explorations..."
                style={{
                  width: "100%",
                  padding: "6px 8px 6px 26px",
                  border: `1px solid ${SAGE[100]}`,
                  background: CREAM[50],
                  fontFamily: FONTS.body,
                  fontSize: 12,
                  color: SAGE[700],
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        )}
        <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
          {loading ? (
            <div style={{ padding: 16, textAlign: "center" }}>
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 12,
                  color: SAGE[400],
                }}
              >
                Loading...
              </span>
            </div>
          ) : explorations.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center" }}>
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 12,
                  color: SAGE[400],
                }}
              >
                No explorations yet
              </span>
            </div>
          ) : filteredExplorations.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center" }}>
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 12,
                  color: SAGE[400],
                }}
              >
                No matching explorations
              </span>
            </div>
          ) : (
            filteredExplorations.map((exp) => (
              <div
                key={exp.id}
                style={{
                  padding: "12px",
                  cursor: "pointer",
                  background:
                    selectedExp === exp.id
                      ? SAGE[50]
                      : "transparent",
                  borderLeft:
                    selectedExp === exp.id
                      ? `2px solid ${SAGE[900]}`
                      : "2px solid transparent",
                  transition: "all 0.15s ease",
                  marginBottom: 2,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
                onClick={() => setSelectedExp(exp.id)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === exp.id ? (
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(exp.id, editingTitle);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onBlur={() => handleRename(exp.id, editingTitle)}
                      style={{
                        fontFamily: FONTS.body,
                        fontSize: 13,
                        color: SAGE[900],
                        fontWeight: 500,
                        width: "100%",
                        border: `1px solid ${SAGE[300]}`,
                        background: CREAM[50],
                        padding: "2px 4px",
                        outline: "none",
                      }}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingId(exp.id);
                        setEditingTitle(exp.title);
                      }}
                      style={{
                        fontFamily: FONTS.body,
                        fontSize: 13,
                        color:
                          selectedExp === exp.id
                            ? SAGE[900]
                            : SAGE[700],
                        display: "block",
                        fontWeight:
                          selectedExp === exp.id ? 500 : 400,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        cursor: "text",
                      }}
                      title="Double-click to rename"
                    >
                      {exp.title}
                    </span>
                  )}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: FONTS.mono,
                        fontSize: 10,
                        color: SAGE[400],
                      }}
                    >
                      {exp.created_at}
                    </span>
                    <span
                      style={{
                        fontFamily: FONTS.mono,
                        fontSize: 10,
                        color: SAGE[300],
                      }}
                    >
                      {exp.message_count} msgs
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteExploration(exp.id);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 2,
                    opacity: 0.4,
                    transition: "opacity 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "0.4";
                  }}
                  title="Delete exploration"
                >
                  <Trash2 size={12} color={SAGE[500]} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Conversation area */}
      {!selectedExp ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 12,
            background: CREAM[100],
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              color: SAGE[400],
            }}
          >
            Select an exploration or create a new one
          </span>
        </div>
      ) : (
        <GloveProvider client={arcClient}>
          <ConversationPanel
            key={selectedExp}
            explorationId={selectedExp}
            savedQueries={savedQueries}
            connections={connections}
            activeConnectionId={selectedExplorationActiveConnectionId}
            onActiveConnectionChange={handleActiveConnectionChange}
          />
        </GloveProvider>
      )}
    </div>
  );
}
