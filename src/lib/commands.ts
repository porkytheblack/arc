import { invoke } from "@tauri-apps/api/core";

// --- Types matching Rust structs exactly ---

export interface DatabaseConnection {
  id: string;
  name: string;
  db_type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  connected: boolean;
  password: string;
  use_ssl: boolean;
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  nullable: boolean;
  primary_key: boolean;
}

export interface TableSchema {
  name: string;
  columns: ColumnInfo[];
  row_count: number;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
  execution_time_ms: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  connections: string[];
  created_at: string;
}

export interface Exploration {
  id: string;
  project_id: string;
  title: string;
  created_at: string;
  message_count: number;
}

export interface SavedQuery {
  id: string;
  name: string;
  description: string;
  sql: string;
  connection_id: string;
  created_at: string;
}

export interface ConnectionNote {
  connection_id: string;
  note: string;
  updated_at: string;
}

export interface DatabaseStats {
  connection_id: string;
  table_count: number;
  total_row_count: number;
  disk_usage_bytes: number;
  connected: boolean;
}

// --- Connection Commands ---

export async function listConnections(): Promise<DatabaseConnection[]> {
  return invoke<DatabaseConnection[]>("list_connections");
}

export async function addConnection(params: {
  name: string;
  dbType: string;
  host: string;
  port: number;
  database: string;
  username: string;
}): Promise<DatabaseConnection> {
  return invoke<DatabaseConnection>("add_connection", {
    name: params.name,
    dbType: params.dbType,
    host: params.host,
    port: params.port,
    database: params.database,
    username: params.username,
  });
}

export async function removeConnection(id: string): Promise<void> {
  return invoke<void>("remove_connection", { id });
}

export async function testConnection(id: string): Promise<boolean> {
  return invoke<boolean>("test_connection", { id });
}

export async function connectDatabase(
  id: string,
  password: string,
  useSsl: boolean = false
): Promise<boolean> {
  return invoke<boolean>("connect_database", { id, password, useSsl });
}

export async function autoConnectProjectConnections(
  projectId: string
): Promise<string[]> {
  return invoke<string[]>("auto_connect_project_connections", { projectId });
}

export async function disconnectDatabase(id: string): Promise<void> {
  return invoke<void>("disconnect_database", { id });
}

// --- Schema Commands ---

export async function getSchema(
  connectionId: string,
  forceRefresh: boolean = false
): Promise<TableSchema[]> {
  return invoke<TableSchema[]>("get_schema", { connectionId, forceRefresh });
}

export async function getCachedSchema(
  connectionId: string
): Promise<TableSchema[] | null> {
  return invoke<TableSchema[] | null>("get_cached_schema", { connectionId });
}

// --- Table Metadata ---

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface ForeignKeyInfo {
  name: string;
  from_column: string;
  to_table: string;
  to_column: string;
}

export interface TableMetadataResult {
  schema: TableSchema;
  indexes: IndexInfo[];
  foreign_keys: ForeignKeyInfo[];
}

export async function getTableMetadata(
  connectionId: string,
  tableName: string
): Promise<TableMetadataResult> {
  return invoke<TableMetadataResult>("get_table_metadata", { connectionId, tableName });
}

// --- Explain Query ---

export async function explainQuery(
  connectionId: string,
  sql: string
): Promise<QueryResult> {
  return invoke<QueryResult>("explain_query", { connectionId, sql });
}

// --- File Writing ---

export async function writeFile(
  path: string,
  contents: string
): Promise<void> {
  return invoke<void>("write_file", { path, contents });
}

// --- Query Commands ---

export async function executeQuery(
  connectionId: string,
  sql: string
): Promise<QueryResult> {
  return invoke<QueryResult>("execute_query", { connectionId, sql });
}

// --- Project Commands ---

export async function listProjects(): Promise<Project[]> {
  return invoke<Project[]>("list_projects");
}

export async function createProject(
  name: string,
  description: string
): Promise<Project> {
  return invoke<Project>("create_project", { name, description });
}

export async function updateProject(params: {
  id: string;
  name?: string;
  description?: string;
}): Promise<Project> {
  return invoke<Project>("update_project", {
    id: params.id,
    name: params.name ?? null,
    description: params.description ?? null,
  });
}

// --- Project-Connection Commands ---

export async function linkConnectionToProject(
  projectId: string,
  connectionId: string
): Promise<void> {
  return invoke<void>("link_connection_to_project", { projectId, connectionId });
}

export async function unlinkConnectionFromProject(
  projectId: string,
  connectionId: string
): Promise<void> {
  return invoke<void>("unlink_connection_from_project", {
    projectId,
    connectionId,
  });
}

export async function listProjectConnections(
  projectId: string
): Promise<DatabaseConnection[]> {
  return invoke<DatabaseConnection[]>("list_project_connections", { projectId });
}

// --- Exploration Commands ---

export async function listExplorations(
  projectId: string
): Promise<Exploration[]> {
  return invoke<Exploration[]>("list_explorations", { projectId });
}

export async function createExploration(
  projectId: string,
  title: string
): Promise<Exploration> {
  return invoke<Exploration>("create_exploration", { projectId, title });
}

export async function updateExploration(
  id: string,
  title: string
): Promise<Exploration> {
  return invoke<Exploration>("update_exploration", { id, title });
}

export async function deleteExploration(id: string): Promise<void> {
  return invoke<void>("delete_exploration", { id });
}

// --- Saved Query Commands ---

export async function listSavedQueries(): Promise<SavedQuery[]> {
  return invoke<SavedQuery[]>("list_saved_queries");
}

export async function saveQuery(params: {
  name: string;
  description: string;
  sql: string;
  connectionId: string;
}): Promise<SavedQuery> {
  return invoke<SavedQuery>("save_query", {
    name: params.name,
    description: params.description,
    sql: params.sql,
    connectionId: params.connectionId,
  });
}

export async function deleteSavedQuery(id: string): Promise<void> {
  return invoke<void>("delete_saved_query", { id });
}

// --- Connection Notes ---

export async function listConnectionNotes(): Promise<ConnectionNote[]> {
  return invoke<ConnectionNote[]>("list_connection_notes");
}

export async function setConnectionNote(
  connectionId: string,
  note: string
): Promise<ConnectionNote> {
  return invoke<ConnectionNote>("set_connection_note", {
    connectionId,
    note,
  });
}

// --- Stats Commands ---

export async function getDatabaseStats(
  connectionId: string
): Promise<DatabaseStats> {
  return invoke<DatabaseStats>("get_database_stats", { connectionId });
}

// --- CSV Import ---

export async function importCsv(
  csvContent: string,
  tableName: string,
  connectionId?: string
): Promise<QueryResult> {
  return invoke<QueryResult>("import_csv", {
    csvContent,
    tableName,
    connectionId: connectionId ?? null,
  });
}

// --- Query Scanner ---

export interface ScanResult {
  file_path: string;
  line_number: number;
  query_snippet: string;
  query_type: string;
}

export async function scanQueries(
  directoryPath: string
): Promise<ScanResult[]> {
  return invoke<ScanResult[]>("scan_queries", { directoryPath });
}

// --- Table Links ---

export interface TableLink {
  id: string;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
  label: string;
  connection_id: string;
}

export async function listTableLinks(): Promise<TableLink[]> {
  return invoke<TableLink[]>("list_table_links");
}

export async function addTableLink(params: {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  label: string;
  connectionId: string;
}): Promise<TableLink> {
  return invoke<TableLink>("add_table_link", {
    sourceTable: params.sourceTable,
    sourceColumn: params.sourceColumn,
    targetTable: params.targetTable,
    targetColumn: params.targetColumn,
    label: params.label,
    connectionId: params.connectionId,
  });
}

export async function removeTableLink(id: string): Promise<void> {
  return invoke<void>("remove_table_link", { id });
}

// --- Exploration Messages ---

export interface ExplorationMessage {
  id: string;
  exploration_id: string;
  role: string;
  content: string;
  metadata: string | null;
  created_at: string;
}

export async function listMessages(
  explorationId: string
): Promise<ExplorationMessage[]> {
  return invoke<ExplorationMessage[]>("list_messages", { explorationId });
}

export async function addMessage(
  explorationId: string,
  role: string,
  content: string,
  metadata?: string
): Promise<ExplorationMessage> {
  return invoke<ExplorationMessage>("add_message", {
    explorationId,
    role,
    content,
    metadata: metadata ?? null,
  });
}

// --- Settings ---

export async function getSetting(key: string): Promise<string | null> {
  return invoke<string | null>("get_setting", { key });
}

export async function setSetting(key: string, value: string): Promise<void> {
  return invoke<void>("set_setting", { key, value });
}

// --- Chat Completion ---

export interface ChatMessage {
  role: string;
  content: string | null;
  tool_calls: ChatToolCall[] | null;
  tool_call_id: string | null;
}

export interface ChatToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  tools: unknown[] | null;
}

export interface ChatCompletionResponse {
  content: string | null;
  tool_calls: ChatToolCall[] | null;
  finish_reason: string;
}

export async function chatCompletion(
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  return invoke<ChatCompletionResponse>("chat_completion", { request });
}
