import { GloveClient, createRemoteStore } from "glove-react";
import type { RemoteStoreActions } from "glove-react";
import type { ModelAdapter, Message } from "glove-core/core";
import { createBrowserAdapter, providers } from "./adapters";
import {
  getSetting,
  listMessages,
  addMessage,
  getMessageTokenCount,
  addMessageTokens,
  getMessageTurnCount,
  incrementMessageTurn,
  resetMessageCounters,
} from "./commands";
import { arcTools } from "./tools";

const ARC_BASE_PROMPT = `You are Arc, a conversational database assistant built on Glove. You help users explore, query, and understand their databases through natural conversation.

Available capabilities:
- Execute SQL queries and display results (execute_query)
- Display compact results for COUNT/AVG/MIN/MAX (show_compact_result)
- View database schema (get_schema)
- Confirm destructive operations before executing (confirm_action)
- Collect form input for INSERT/UPDATE operations (collect_form)
- Generate charts from query results (show_chart)
- Save queries to the library (save_query)
- Execute saved queries with parameter injection (execute_saved_query)
- Import CSV files as queryable tables (import_csv)
- Show database statistics (get_database_stats)
- Scan codebases for embedded SQL queries (scan_queries)
- Set up new database connections via wizard (setup_connection)
- Show connection status inline (show_connection_status)
- Build visual WHERE clause filters (build_filter)
- Suggest follow-up actions (show_suggestions)
- Disambiguate when multiple options match (disambiguate)
- Show success notifications (show_success)
- View table metadata including indexes and foreign keys (get_table_metadata)
- Show query execution plans (explain_query)
- Merge/interpolate results from different connections after querying (merge_query_results)

Guidelines:
- Always use tools to show data rather than describing it in text
- Before writing SQL that references tables/columns, call get_schema first if schema context is missing or stale
- For non-trivial joins/filters, call get_table_metadata on involved tables before executing queries
- Use structured tool-call outputs (JSON) from previous turns as authoritative context for table/column names
- For destructive operations (INSERT, UPDATE, DELETE, DROP), always use confirm_action first
- After major actions, use show_suggestions to offer follow-up options
- When multiple tables match a query, use disambiguate to ask which one
- For scalar results (COUNT, MAX, MIN, AVG), prefer show_compact_result
- If execute_query returns an unknown table/column error, refresh schema/metadata and retry with corrected SQL
- For multi-connection requests, try active/default connection first; if unresolved, query other relevant connections and merge results with merge_query_results
- Cross-connection merge workflow:
  1) Run execute_query on the active/default connection first.
  2) If that cannot fully answer the request (missing tables/columns/data), run execute_query on additional relevant connections.
  3) Use the structured object rows from execute_query output as merge inputs; include connectionId/label for each side.
  4) Call merge_query_results with explicit leftKey, rightKey, mergeType (inner/left/right/full), and clear prefixes.
  5) Check merge stats and row counts; if matches are near zero, adjust join keys or ask the user to clarify key mapping.
  6) After merging, continue analysis/visualization from merged output (show_chart or show_compact_result when requested).
- Never invent join keys or schemas; derive keys from schema/tool outputs or ask for clarification
- Keep text responses short \u2014 1-2 sentences between tool calls
- Use the active/default connection in context unless the user explicitly requests another one
- If a tool renders UI output, do not repeat the full table/card payload in text`;

const COMPACTION_MESSAGE_PREFIX = "[Conversation summary from compaction]";

export interface ProjectContext {
  projectName: string;
  projectDescription: string;
  connections: Array<{
    id: string;
    name: string;
    db_type: string;
    database: string;
    connected: boolean;
  }>;
  activeConnectionId?: string;
  connectionNotes?: Array<{
    connection_id: string;
    note: string;
    updated_at: string;
  }>;
  savedQueries?: Array<{
    id: string;
    name: string;
    description: string;
    sql: string;
    connection_id: string;
    params: string[];
    slashAlias: string;
  }>;
}

export function buildSystemPrompt(context?: ProjectContext): string {
  if (!context) return ARC_BASE_PROMPT;

  const preferredConnection = context.activeConnectionId
    ? context.connections.find((c) => c.id === context.activeConnectionId)
    : undefined;
  const fallbackConnection =
    context.connections.find((c) => c.connected) || context.connections[0];
  const defaultConnection = preferredConnection || fallbackConnection;

  const connLines = context.connections.map((c) =>
    `  - ${c.name} (${c.db_type}, id: "${c.id}", database: "${c.database}", ${c.connected ? "connected" : "disconnected"})`
  );

  const notesByConnection = new Map(
    (context.connectionNotes || [])
      .filter((n) => n.note.trim().length > 0)
      .map((n) => [n.connection_id, n])
  );

  const noteLines = context.connections
    .map((c) => {
      const note = notesByConnection.get(c.id);
      if (!note) return null;
      return `  - ${c.name} (${c.id}): ${note.note}`;
    })
    .filter((line): line is string => Boolean(line));

  const queryLines = (context.savedQueries || []).slice(0, 60).map((q) => {
    const params = q.params.length > 0 ? q.params.join(", ") : "(none)";
    const sqlSnippet = q.sql.replace(/\s+/g, " ").trim().slice(0, 220);
    return `  - ${q.name} (id: "${q.id}", slash: "/${q.slashAlias}", connection: "${q.connection_id}", params: ${params})${q.description ? ` -- ${q.description}` : ""} SQL: ${sqlSnippet}`;
  });

  return `${ARC_BASE_PROMPT}

Current workspace context:
- Project: ${context.projectName}
- Description: ${context.projectDescription || "No description"}
- Database connections:
${connLines.length > 0 ? connLines.join("\n") : "  (none configured)"}

- Connection notes (user-authored guidance):
${noteLines.length > 0 ? noteLines.join("\n") : "  (none)"}

- Saved query catalog (prefer execute_saved_query when relevant):
${queryLines.length > 0 ? queryLines.join("\n") : "  (none)"}

When a user types a slash reference like "/query-name key=value", treat it as a saved-query invocation and call execute_saved_query with those params.
${defaultConnection ? `\nThe active/default connection to use is "${defaultConnection.id}" (${defaultConnection.name}).` : "\nNo databases are currently connected. Suggest the user connect one first."}`;
}

// ─── Persistent store via Tauri DB ───────────────────────────────────────────

const storeActions: RemoteStoreActions = {
  async getMessages(sessionId: string): Promise<Message[]> {
    const rows = await listMessages(sessionId);
    return rows.map((row) => {
      let meta: Record<string, unknown> = {};
      if (row.metadata) {
        try {
          meta = JSON.parse(row.metadata) as Record<string, unknown>;
        } catch {
          meta = {};
        }
      }
      const isCompaction =
        meta.is_compaction === true ||
        row.content.trimStart().startsWith(COMPACTION_MESSAGE_PREFIX);
      const message: Message = {
        sender: row.role as "user" | "agent",
        text: row.content,
      };
      if (Array.isArray(meta.tool_calls)) message.tool_calls = meta.tool_calls as Message["tool_calls"];
      if (Array.isArray(meta.tool_results)) message.tool_results = meta.tool_results as Message["tool_results"];
      if (Array.isArray(meta.content)) message.content = meta.content as Message["content"];
      if (isCompaction) message.is_compaction = true;
      return message;
    });
  },

  async appendMessages(sessionId: string, msgs: Message[]): Promise<void> {
    for (const msg of msgs) {
      const role = msg.sender === "agent" ? "agent" : "user";
      const metadata: Record<string, unknown> = {};
      if (msg.tool_calls?.length) metadata.tool_calls = msg.tool_calls;
      if (msg.tool_results?.length) metadata.tool_results = msg.tool_results;
      if (msg.content?.length) metadata.content = msg.content;
      if (msg.is_compaction) metadata.is_compaction = true;

      const metaStr = Object.keys(metadata).length > 0
        ? JSON.stringify(metadata)
        : undefined;

      await addMessage(sessionId, role, msg.text || "", metaStr);
    }
  },

  async getTokenCount(sessionId: string): Promise<number> {
    return getMessageTokenCount(sessionId);
  },

  async addTokens(sessionId: string, count: number): Promise<void> {
    await addMessageTokens(sessionId, Math.trunc(count));
  },

  async getTurnCount(sessionId: string): Promise<number> {
    return getMessageTurnCount(sessionId);
  },

  async incrementTurn(sessionId: string): Promise<void> {
    await incrementMessageTurn(sessionId);
  },

  async resetCounters(sessionId: string): Promise<void> {
    await resetMessageCounters(sessionId);
  },
};

// ─── Model adapter cache ─────────────────────────────────────────────────────

let cachedAdapter: ModelAdapter | null = null;
let cachedAdapterKey = "";

async function resolveAdapter(): Promise<ModelAdapter> {
  const [provider, apiKey, aiModel] = await Promise.all([
    getSetting("ai_provider"),
    getSetting("ai_api_key"),
    getSetting("ai_model"),
  ]);

  const prov = provider || "openrouter";
  const key = apiKey?.trim() || "";
  const providerDef = providers[prov] || providers.openrouter;
  const model = aiModel || providerDef.defaultModel;

  if (!key) throw new Error("No API key configured. Go to Settings → AI Provider to add one.");

  const cacheKey = `${prov}:${key}:${model}`;
  if (cachedAdapter && cachedAdapterKey === cacheKey) {
    return cachedAdapter;
  }

  const adapter = createBrowserAdapter({
    provider: prov,
    model,
    apiKey: key,
    stream: true,
  });

  cachedAdapter = adapter;
  cachedAdapterKey = cacheKey;
  return adapter;
}

export function createArcClient(context?: ProjectContext): GloveClient {
  const systemPrompt = buildSystemPrompt(context);

  return new GloveClient({
    createModel: () => {
      let realAdapter: ModelAdapter | null = null;
      const proxy: ModelAdapter = {
        name: "arc-model",
        setSystemPrompt(sp: string) {
          if (realAdapter) realAdapter.setSystemPrompt(sp);
        },
        async prompt(request, notify, signal) {
          realAdapter = await resolveAdapter();
          realAdapter.setSystemPrompt(systemPrompt);
          return realAdapter.prompt(request, notify, signal);
        },
      };
      return proxy;
    },
    createStore: (sessionId: string) => createRemoteStore(sessionId, storeActions),
    systemPrompt,
    tools: arcTools,
  });
}
