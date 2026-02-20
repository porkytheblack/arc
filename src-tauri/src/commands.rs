use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Manager, State};
use thiserror::Error;

use crate::adapter::{ConnectParams, ConnectionManager, DatabaseKind};
use crate::db::Database;

// --- Error handling ---

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),
    #[error("Query error: {0}")]
    QueryError(String),
    #[error("CSV parse error: {0}")]
    CsvParseError(String),
    #[error("Scan error: {0}")]
    ScanError(String),
    #[error("Database error: {0}")]
    DatabaseError(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

// --- Data types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConnection {
    pub id: String,
    pub name: String,
    pub db_type: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub connected: bool,
    pub password: String,
    pub use_ssl: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableSchema {
    pub name: String,
    pub columns: Vec<ColumnInfo>,
    pub row_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub primary_key: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub row_count: usize,
    pub execution_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub connections: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Exploration {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub created_at: String,
    pub message_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExplorationMessage {
    pub id: String,
    pub exploration_id: String,
    pub role: String,
    pub content: String,
    pub metadata: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedQuery {
    pub id: String,
    pub name: String,
    pub description: String,
    pub sql: String,
    pub connection_id: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedChart {
    pub id: String,
    pub name: String,
    pub description: String,
    pub chart_type: String,
    pub x_key: String,
    pub y_key: String,
    pub connection_id: Option<String>,
    pub sql: Option<String>,
    pub data: serde_json::Value,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionNote {
    pub connection_id: String,
    pub note: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseStats {
    pub connection_id: String,
    pub table_count: u32,
    pub total_row_count: u64,
    pub disk_usage_bytes: u64,
    pub connected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub file_path: String,
    pub line_number: usize,
    pub query_snippet: String,
    pub query_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableLink {
    pub id: String,
    pub source_table: String,
    pub source_column: String,
    pub target_table: String,
    pub target_column: String,
    pub label: String,
    pub connection_id: String,
}

// --- Chat completion types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: Option<String>,
    pub tool_calls: Option<Vec<ToolCallInfo>>,
    pub tool_call_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallInfo {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: FunctionCallInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCallInfo {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionRequest {
    pub messages: Vec<ChatMessage>,
    pub tools: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionResponse {
    pub content: Option<String>,
    pub tool_calls: Option<Vec<ToolCallInfo>>,
    pub finish_reason: String,
}

// --- Commands ---

#[tauri::command]
pub fn list_connections(db: State<'_, Database>) -> Result<Vec<DatabaseConnection>, AppError> {
    db.list_connections()
}

#[tauri::command]
pub fn add_connection(
    name: String,
    db_type: String,
    host: String,
    port: u16,
    database: String,
    username: String,
    db: State<'_, Database>,
) -> Result<DatabaseConnection, AppError> {
    db.add_connection(&name, &db_type, &host, port, &database, &username)
}

#[tauri::command]
pub fn remove_connection(
    id: String,
    app_handle: AppHandle,
    db: State<'_, Database>,
    conn_manager: State<'_, ConnectionManager>,
) -> Result<(), AppError> {
    // Check if this is a CSV-sourced SQLite DB and clean up the file
    let connections = db.list_connections()?;
    if let Some(conn_info) = connections.iter().find(|c| c.id == id) {
        if conn_info.db_type == "SQLite" {
            if let Ok(app_dir) = app_handle.path().app_data_dir() {
                let csv_dir = app_dir.join("csv_databases");
                let db_path = Path::new(&conn_info.database);
                if db_path.starts_with(&csv_dir) {
                    // Disconnect first so the file isn't locked
                    let _ = conn_manager.disconnect(&id);
                    let _ = fs::remove_file(db_path);
                }
            }
        }
    }
    db.remove_connection(&id)
}

#[tauri::command]
pub fn create_csv_connection(
    csv_content: String,
    file_name: String,
    project_id: String,
    app_handle: AppHandle,
    db: State<'_, Database>,
    conn_manager: State<'_, ConnectionManager>,
) -> Result<DatabaseConnection, AppError> {
    let table_name = file_name
        .trim_end_matches(".csv")
        .replace(|c: char| !c.is_alphanumeric() && c != '_', "_");

    // Create csv_databases directory in app data dir
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::DatabaseError(format!("Failed to get app data dir: {e}")))?;
    let csv_dir = app_dir.join("csv_databases");
    fs::create_dir_all(&csv_dir)
        .map_err(|e| AppError::DatabaseError(format!("Failed to create csv_databases dir: {e}")))?;

    // Generate unique SQLite file path
    let db_file = csv_dir.join(format!("{}.db", uuid::Uuid::new_v4()));
    let db_path_str = db_file.to_string_lossy().to_string();

    // Create connection record
    let display_name = file_name.trim_end_matches(".csv").to_string();
    let conn = db.add_connection(&display_name, "SQLite", "localhost", 0, &db_path_str, "")?;

    // Connect to the new SQLite DB
    let params = ConnectParams {
        kind: DatabaseKind::SQLite,
        host: "localhost".to_string(),
        port: 0,
        database: db_path_str.clone(),
        username: String::new(),
        password: String::new(),
        use_ssl: false,
    };
    conn_manager.connect(&conn.id, &params)?;
    db.set_connection_status(&conn.id, true)?;

    // Import CSV data using the same logic as import_csv
    let mut lines = csv_content.lines();
    let header_line = lines.next().ok_or_else(|| {
        AppError::CsvParseError("CSV is empty, no header row found".into())
    })?;

    let columns: Vec<String> = header_line
        .split(',')
        .map(|s| s.trim().trim_matches('"').to_string())
        .collect();

    if columns.is_empty() {
        return Err(AppError::CsvParseError("No columns found in CSV header".into()));
    }

    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
    for line in lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let values: Vec<serde_json::Value> = trimmed
            .split(',')
            .map(|s| {
                let s = s.trim().trim_matches('"');
                if let Ok(n) = s.parse::<i64>() {
                    serde_json::Value::from(n)
                } else if let Ok(f) = s.parse::<f64>() {
                    serde_json::json!(f)
                } else if s == "true" {
                    serde_json::Value::Bool(true)
                } else if s == "false" {
                    serde_json::Value::Bool(false)
                } else {
                    serde_json::Value::String(s.to_string())
                }
            })
            .collect();
        rows.push(values);
    }

    // Create table and insert rows
    let adapter = conn_manager.get(&conn.id)?;

    let col_defs: Vec<String> = columns
        .iter()
        .enumerate()
        .map(|(i, name)| {
            let sample = rows
                .first()
                .and_then(|r| r.get(i))
                .unwrap_or(&serde_json::Value::Null);
            let type_str = match sample {
                serde_json::Value::Number(n) => {
                    if n.is_f64() { "REAL" } else { "INTEGER" }
                }
                serde_json::Value::Bool(_) => "BOOLEAN",
                _ => "TEXT",
            };
            format!("\"{}\" {}", name, type_str)
        })
        .collect();

    let create_sql = format!(
        "CREATE TABLE IF NOT EXISTS \"{}\" ({})",
        table_name,
        col_defs.join(", ")
    );
    adapter.execute_statement(&create_sql)?;

    let col_list = columns
        .iter()
        .map(|c| format!("\"{}\"", c))
        .collect::<Vec<_>>()
        .join(", ");

    const BATCH_SIZE: usize = 50;
    for chunk in rows.chunks(BATCH_SIZE) {
        let value_groups: Vec<String> = chunk
            .iter()
            .map(|row| {
                let placeholders: Vec<String> = row
                    .iter()
                    .map(|v| match v {
                        serde_json::Value::Null => "NULL".to_string(),
                        serde_json::Value::Number(n) => n.to_string(),
                        serde_json::Value::Bool(b) => b.to_string(),
                        serde_json::Value::String(s) => {
                            format!("'{}'", s.replace('\'', "''"))
                        }
                        _ => format!("'{}'", v),
                    })
                    .collect();
                format!("({})", placeholders.join(", "))
            })
            .collect();

        let insert_sql = format!(
            "INSERT INTO \"{}\" ({}) VALUES {}",
            table_name,
            col_list,
            value_groups.join(", ")
        );
        adapter.execute_statement(&insert_sql)?;
    }

    // Link to project
    db.link_connection_to_project(&project_id, &conn.id)?;

    Ok(DatabaseConnection {
        connected: true,
        ..conn
    })
}

#[tauri::command]
pub fn test_connection(
    id: String,
    conn_manager: State<'_, ConnectionManager>,
) -> Result<bool, AppError> {
    match conn_manager.get(&id) {
        Ok(adapter) => adapter.test_connection(),
        Err(_) => {
            // Connection not yet active — try to connect first using stored params
            Ok(false)
        }
    }
}

#[tauri::command]
pub fn connect_database(
    id: String,
    password: String,
    use_ssl: bool,
    db: State<'_, Database>,
    conn_manager: State<'_, ConnectionManager>,
) -> Result<bool, AppError> {
    let connections = db.list_connections()?;
    let conn_info = connections
        .iter()
        .find(|c| c.id == id)
        .ok_or_else(|| AppError::NotFound(format!("Connection {} not found", id)))?;

    let kind = DatabaseKind::from_str_loose(&conn_info.db_type)
        .ok_or_else(|| AppError::ConnectionFailed(format!("Unsupported database type: {}", conn_info.db_type)))?;

    let params = ConnectParams {
        kind,
        host: conn_info.host.clone(),
        port: conn_info.port,
        database: conn_info.database.clone(),
        username: conn_info.username.clone(),
        password: password.clone(),
        use_ssl,
    };

    conn_manager.connect(&id, &params)?;
    db.set_connection_status(&id, true)?;
    db.save_connection_credentials(&id, &password, use_ssl)?;
    Ok(true)
}

#[tauri::command]
pub fn auto_connect_project_connections(
    project_id: String,
    db: State<'_, Database>,
    conn_manager: State<'_, ConnectionManager>,
) -> Result<Vec<String>, AppError> {
    let connections = db.list_project_connections(&project_id)?;

    let mut already_connected = Vec::new();
    let mut to_connect: Vec<(String, ConnectParams)> = Vec::new();

    for conn_info in &connections {
        if conn_info.password.is_empty() && conn_info.db_type != "SQLite" {
            continue;
        }

        if conn_manager.get(&conn_info.id).is_ok() {
            already_connected.push(conn_info.id.clone());
            continue;
        }

        let kind = match DatabaseKind::from_str_loose(&conn_info.db_type) {
            Some(k) => k,
            None => continue,
        };

        to_connect.push((
            conn_info.id.clone(),
            ConnectParams {
                kind,
                host: conn_info.host.clone(),
                port: conn_info.port,
                database: conn_info.database.clone(),
                username: conn_info.username.clone(),
                password: conn_info.password.clone(),
                use_ssl: conn_info.use_ssl,
            },
        ));
    }

    let cm = &*conn_manager;
    let newly_connected: Vec<String> = std::thread::scope(|s| {
        let handles: Vec<_> = to_connect
            .iter()
            .map(|(id, params)| {
                s.spawn(move || {
                    if cm.connect(id, params).is_ok() {
                        Some(id.clone())
                    } else {
                        None
                    }
                })
            })
            .collect();

        handles
            .into_iter()
            .filter_map(|h| h.join().ok().flatten())
            .collect()
    });

    for id in &newly_connected {
        db.set_connection_status(id, true).ok();
    }

    let mut connected_ids = already_connected;
    connected_ids.extend(newly_connected);
    Ok(connected_ids)
}

#[tauri::command]
pub fn disconnect_database(
    id: String,
    db: State<'_, Database>,
    conn_manager: State<'_, ConnectionManager>,
) -> Result<(), AppError> {
    conn_manager.disconnect(&id)?;
    db.set_connection_status(&id, false)?;
    Ok(())
}

fn schema_cache_key(connection_id: &str) -> String {
    format!("schema_cache:{connection_id}")
}

fn load_cached_schema(db: &Database, connection_id: &str) -> Result<Option<Vec<TableSchema>>, AppError> {
    let key = schema_cache_key(connection_id);
    let Some(raw) = db.get_setting(&key)? else {
        return Ok(None);
    };

    Ok(serde_json::from_str::<Vec<TableSchema>>(&raw).ok())
}

fn save_cached_schema(db: &Database, connection_id: &str, schema: &[TableSchema]) -> Result<(), AppError> {
    let key = schema_cache_key(connection_id);
    let value = serde_json::to_string(schema)
        .map_err(|e| AppError::DatabaseError(format!("Failed to serialize schema cache: {e}")))?;
    db.set_setting(&key, &value)
}

#[tauri::command]
pub fn get_cached_schema(
    connection_id: String,
    db: State<'_, Database>,
) -> Result<Option<Vec<TableSchema>>, AppError> {
    load_cached_schema(&db, &connection_id)
}

#[tauri::command]
pub fn get_schema(
    connection_id: String,
    force_refresh: Option<bool>,
    db: State<'_, Database>,
    conn_manager: State<'_, ConnectionManager>,
) -> Result<Vec<TableSchema>, AppError> {
    let force_refresh = force_refresh.unwrap_or(false);

    if !force_refresh {
        if let Some(cached) = load_cached_schema(&db, &connection_id)? {
            return Ok(cached);
        }
    }

    let adapter = conn_manager.get(&connection_id)?;
    let schema = adapter.get_schema()?;
    save_cached_schema(&db, &connection_id, &schema)?;
    Ok(schema)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableMetadataResult {
    pub schema: TableSchema,
    pub indexes: Vec<IndexInfoResult>,
    pub foreign_keys: Vec<ForeignKeyResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexInfoResult {
    pub name: String,
    pub columns: Vec<String>,
    pub unique: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForeignKeyResult {
    pub name: String,
    pub from_column: String,
    pub to_table: String,
    pub to_column: String,
}

#[tauri::command]
pub fn get_table_metadata(
    connection_id: String,
    table_name: String,
    conn_manager: State<'_, ConnectionManager>,
) -> Result<TableMetadataResult, AppError> {
    let adapter = conn_manager.get(&connection_id)?;
    let meta = adapter.get_table_metadata(&table_name)?;
    Ok(TableMetadataResult {
        schema: meta.schema,
        indexes: meta.indexes.into_iter().map(|i| IndexInfoResult {
            name: i.name,
            columns: i.columns,
            unique: i.unique,
        }).collect(),
        foreign_keys: meta.foreign_keys.into_iter().map(|fk| ForeignKeyResult {
            name: fk.name,
            from_column: fk.from_column,
            to_table: fk.to_table,
            to_column: fk.to_column,
        }).collect(),
    })
}

#[tauri::command]
pub fn explain_query(
    connection_id: String,
    sql: String,
    conn_manager: State<'_, ConnectionManager>,
) -> Result<QueryResult, AppError> {
    let explain_sql = format!("EXPLAIN {}", sql);
    let adapter = conn_manager.get(&connection_id)?;
    adapter.execute_query(&explain_sql)
}

#[tauri::command]
pub fn write_file(path: String, contents: String) -> Result<(), AppError> {
    fs::write(&path, contents).map_err(|e| {
        AppError::DatabaseError(format!("Failed to write file {}: {}", path, e))
    })
}

#[tauri::command]
pub fn execute_query(
    connection_id: String,
    sql: String,
    conn_manager: State<'_, ConnectionManager>,
) -> Result<QueryResult, AppError> {
    let adapter = conn_manager.get(&connection_id)?;
    adapter.execute_query(&sql)
}

#[tauri::command]
pub fn list_projects(db: State<'_, Database>) -> Result<Vec<Project>, AppError> {
    db.list_projects()
}

#[tauri::command]
pub fn create_project(
    name: String,
    description: String,
    db: State<'_, Database>,
) -> Result<Project, AppError> {
    db.create_project(&name, &description)
}

#[tauri::command]
pub fn update_project(
    id: String,
    name: Option<String>,
    description: Option<String>,
    db: State<'_, Database>,
) -> Result<Project, AppError> {
    db.update_project(&id, name.as_deref(), description.as_deref())
}

#[tauri::command]
pub fn link_connection_to_project(
    project_id: String,
    connection_id: String,
    db: State<'_, Database>,
) -> Result<(), AppError> {
    db.link_connection_to_project(&project_id, &connection_id)
}

#[tauri::command]
pub fn unlink_connection_from_project(
    project_id: String,
    connection_id: String,
    db: State<'_, Database>,
) -> Result<(), AppError> {
    db.unlink_connection_from_project(&project_id, &connection_id)
}

#[tauri::command]
pub fn list_project_connections(
    project_id: String,
    db: State<'_, Database>,
) -> Result<Vec<DatabaseConnection>, AppError> {
    db.list_project_connections(&project_id)
}

#[tauri::command]
pub fn list_explorations(
    project_id: String,
    db: State<'_, Database>,
) -> Result<Vec<Exploration>, AppError> {
    db.list_explorations(&project_id)
}

#[tauri::command]
pub fn create_exploration(
    project_id: String,
    title: String,
    db: State<'_, Database>,
) -> Result<Exploration, AppError> {
    db.create_exploration(&project_id, &title)
}

#[tauri::command]
pub fn update_exploration(
    id: String,
    title: String,
    db: State<'_, Database>,
) -> Result<Exploration, AppError> {
    db.update_exploration(&id, &title)
}

#[tauri::command]
pub fn delete_exploration(id: String, db: State<'_, Database>) -> Result<(), AppError> {
    db.delete_exploration(&id)
}

#[tauri::command]
pub fn list_messages(
    exploration_id: String,
    db: State<'_, Database>,
) -> Result<Vec<ExplorationMessage>, AppError> {
    db.list_messages(&exploration_id)
}

#[tauri::command]
pub fn add_message(
    exploration_id: String,
    role: String,
    content: String,
    metadata: Option<String>,
    db: State<'_, Database>,
) -> Result<ExplorationMessage, AppError> {
    db.add_message(&exploration_id, &role, &content, metadata.as_deref())
}

#[tauri::command]
pub fn get_message_token_count(
    exploration_id: String,
    db: State<'_, Database>,
) -> Result<u64, AppError> {
    db.get_exploration_token_count(&exploration_id)
}

#[tauri::command]
pub fn add_message_tokens(
    exploration_id: String,
    count: i64,
    db: State<'_, Database>,
) -> Result<(), AppError> {
    db.add_exploration_tokens(&exploration_id, count)
}

#[tauri::command]
pub fn get_message_turn_count(
    exploration_id: String,
    db: State<'_, Database>,
) -> Result<u64, AppError> {
    db.get_exploration_turn_count(&exploration_id)
}

#[tauri::command]
pub fn increment_message_turn(
    exploration_id: String,
    db: State<'_, Database>,
) -> Result<(), AppError> {
    db.increment_exploration_turn(&exploration_id)
}

#[tauri::command]
pub fn reset_message_history(
    exploration_id: String,
    db: State<'_, Database>,
) -> Result<(), AppError> {
    db.reset_exploration_history(&exploration_id)
}

#[tauri::command]
pub fn list_saved_queries(db: State<'_, Database>) -> Result<Vec<SavedQuery>, AppError> {
    db.list_saved_queries()
}

#[tauri::command]
pub fn save_query(
    name: String,
    description: String,
    sql: String,
    connection_id: String,
    db: State<'_, Database>,
) -> Result<SavedQuery, AppError> {
    db.save_query(&name, &description, &sql, &connection_id)
}

#[tauri::command]
pub fn delete_saved_query(id: String, db: State<'_, Database>) -> Result<(), AppError> {
    db.delete_saved_query(&id)
}

#[tauri::command]
pub fn list_saved_charts(db: State<'_, Database>) -> Result<Vec<SavedChart>, AppError> {
    db.list_saved_charts()
}

#[tauri::command]
pub fn save_saved_chart(
    name: String,
    description: String,
    chart_type: String,
    x_key: String,
    y_key: String,
    connection_id: Option<String>,
    sql: Option<String>,
    data: serde_json::Value,
    db: State<'_, Database>,
) -> Result<SavedChart, AppError> {
    db.save_saved_chart(
        &name,
        &description,
        &chart_type,
        &x_key,
        &y_key,
        connection_id.as_deref(),
        sql.as_deref(),
        &data,
    )
}

#[tauri::command]
pub fn delete_saved_chart(id: String, db: State<'_, Database>) -> Result<(), AppError> {
    db.delete_saved_chart(&id)
}

#[tauri::command]
pub fn list_connection_notes(db: State<'_, Database>) -> Result<Vec<ConnectionNote>, AppError> {
    db.list_connection_notes()
}

#[tauri::command]
pub fn set_connection_note(
    connection_id: String,
    note: String,
    db: State<'_, Database>,
) -> Result<ConnectionNote, AppError> {
    db.set_connection_note(&connection_id, &note)
}

#[tauri::command]
pub fn get_database_stats(
    connection_id: String,
    db: State<'_, Database>,
    conn_manager: State<'_, ConnectionManager>,
) -> Result<DatabaseStats, AppError> {
    // Try real adapter first
    if let Ok(adapter) = conn_manager.get(&connection_id) {
        let stats = adapter.get_stats()?;
        return Ok(DatabaseStats {
            connection_id: connection_id.clone(),
            table_count: stats.table_count,
            total_row_count: stats.total_row_count,
            disk_usage_bytes: stats.disk_usage_bytes,
            connected: true,
        });
    }
    // Fall back to app DB metadata
    db.get_database_stats(&connection_id)
}

#[tauri::command]
pub fn import_csv(
    csv_content: String,
    table_name: String,
    connection_id: Option<String>,
    conn_manager: State<'_, ConnectionManager>,
) -> Result<QueryResult, AppError> {
    let mut lines = csv_content.lines();
    let header_line = lines.next().ok_or_else(|| {
        AppError::CsvParseError("CSV is empty, no header row found".into())
    })?;

    let columns: Vec<String> = header_line
        .split(',')
        .map(|s| s.trim().trim_matches('"').to_string())
        .collect();

    if columns.is_empty() {
        return Err(AppError::CsvParseError("No columns found in CSV header".into()));
    }

    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
    for line in lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let values: Vec<serde_json::Value> = trimmed
            .split(',')
            .map(|s| {
                let s = s.trim().trim_matches('"');
                if let Ok(n) = s.parse::<i64>() {
                    serde_json::Value::from(n)
                } else if let Ok(f) = s.parse::<f64>() {
                    serde_json::json!(f)
                } else if s == "true" {
                    serde_json::Value::Bool(true)
                } else if s == "false" {
                    serde_json::Value::Bool(false)
                } else {
                    serde_json::Value::String(s.to_string())
                }
            })
            .collect();
        rows.push(values);
    }

    let row_count = rows.len();

    // If a connection is active, create the table and insert rows
    if let Some(ref conn_id) = connection_id {
        if let Ok(adapter) = conn_manager.get(conn_id) {
            let import_start = std::time::Instant::now();
            let import_timeout = std::time::Duration::from_secs(120);

            // Infer column types from first row
            let col_defs: Vec<String> = columns
                .iter()
                .enumerate()
                .map(|(i, name)| {
                    let sample = rows
                        .first()
                        .and_then(|r| r.get(i))
                        .unwrap_or(&serde_json::Value::Null);
                    let type_str = match sample {
                        serde_json::Value::Number(n) => {
                            if n.is_f64() { "REAL" } else { "INTEGER" }
                        }
                        serde_json::Value::Bool(_) => "BOOLEAN",
                        _ => "TEXT",
                    };
                    format!("\"{}\" {}", name, type_str)
                })
                .collect();

            let create_sql = format!(
                "CREATE TABLE IF NOT EXISTS \"{}\" ({})",
                table_name,
                col_defs.join(", ")
            );
            adapter.execute_statement(&create_sql)?;

            // Insert rows in batches of 50 using multi-row VALUES
            let col_list = columns
                .iter()
                .map(|c| format!("\"{}\"", c))
                .collect::<Vec<_>>()
                .join(", ");

            const BATCH_SIZE: usize = 50;
            for chunk in rows.chunks(BATCH_SIZE) {
                if import_start.elapsed() > import_timeout {
                    return Err(AppError::QueryError(
                        "CSV import timed out after 120 seconds".to_string(),
                    ));
                }

                let value_groups: Vec<String> = chunk
                    .iter()
                    .map(|row| {
                        let placeholders: Vec<String> = row
                            .iter()
                            .map(|v| match v {
                                serde_json::Value::Null => "NULL".to_string(),
                                serde_json::Value::Number(n) => n.to_string(),
                                serde_json::Value::Bool(b) => b.to_string(),
                                serde_json::Value::String(s) => {
                                    format!("'{}'", s.replace('\'', "''"))
                                }
                                _ => format!("'{}'", v),
                            })
                            .collect();
                        format!("({})", placeholders.join(", "))
                    })
                    .collect();

                let insert_sql = format!(
                    "INSERT INTO \"{}\" ({}) VALUES {}",
                    table_name,
                    col_list,
                    value_groups.join(", ")
                );
                adapter.execute_statement(&insert_sql)?;
            }
        }
    }

    Ok(QueryResult {
        columns,
        rows,
        row_count,
        execution_time_ms: 0,
    })
}

// --- Query Scanner ---

const SCANNABLE_EXTENSIONS: &[&str] = &[
    "rs", "ts", "tsx", "js", "jsx", "py", "go", "java", "rb",
];

const SQL_KEYWORDS: &[&str] = &[
    "SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER",
];

fn classify_query(line: &str) -> Option<&'static str> {
    let upper = line.trim().to_uppercase();
    SQL_KEYWORDS
        .iter()
        .find(|&&keyword| upper.contains(keyword))
        .copied()
}

fn has_scannable_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SCANNABLE_EXTENSIONS.contains(&ext))
        .unwrap_or(false)
}

fn walk_directory(dir: &Path, results: &mut Vec<ScanResult>, max_results: usize) -> Result<(), AppError> {
    if results.len() >= max_results {
        return Ok(());
    }

    let entries = fs::read_dir(dir).map_err(|e| {
        AppError::ScanError(format!("Cannot read directory {}: {}", dir.display(), e))
    })?;

    for entry in entries {
        if results.len() >= max_results {
            break;
        }

        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();

        if path.is_dir() {
            let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if dir_name.starts_with('.') || dir_name == "node_modules" || dir_name == "target" || dir_name == "vendor" || dir_name == "dist" || dir_name == "build" {
                continue;
            }
            walk_directory(&path, results, max_results)?;
        } else if has_scannable_extension(&path) {
            let content = match fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            for (line_idx, line) in content.lines().enumerate() {
                if results.len() >= max_results {
                    break;
                }

                if let Some(query_type) = classify_query(line) {
                    let snippet = line.trim().to_string();
                    let truncated = if snippet.len() > 200 {
                        format!("{}...", &snippet[..200])
                    } else {
                        snippet
                    };

                    results.push(ScanResult {
                        file_path: path.display().to_string(),
                        line_number: line_idx + 1,
                        query_snippet: truncated,
                        query_type: query_type.to_string(),
                    });
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn scan_queries(directory_path: String) -> Result<Vec<ScanResult>, AppError> {
    let path = Path::new(&directory_path);
    if !path.exists() {
        return Err(AppError::ScanError(format!(
            "Directory does not exist: {}",
            directory_path
        )));
    }
    if !path.is_dir() {
        return Err(AppError::ScanError(format!(
            "Path is not a directory: {}",
            directory_path
        )));
    }

    let mut results = Vec::new();
    let max_results = 500;
    walk_directory(path, &mut results, max_results)?;
    Ok(results)
}

// --- Table Links ---

#[tauri::command]
pub fn list_table_links(db: State<'_, Database>) -> Result<Vec<TableLink>, AppError> {
    db.list_table_links()
}

#[tauri::command]
pub fn add_table_link(
    source_table: String,
    source_column: String,
    target_table: String,
    target_column: String,
    label: String,
    connection_id: String,
    db: State<'_, Database>,
) -> Result<TableLink, AppError> {
    db.add_table_link(&source_table, &source_column, &target_table, &target_column, &label, &connection_id)
}

#[tauri::command]
pub fn remove_table_link(id: String, db: State<'_, Database>) -> Result<(), AppError> {
    db.remove_table_link(&id)
}

// --- Chat Completion ---
// This is the local tool-dispatch engine. It examines the last user message
// and decides which Glove tool to invoke. In a production setup this would
// be replaced by an LLM call; the keyword dispatcher remains as a reliable
// fallback when no API key is configured.

fn quick_schema_lookup(adapter: &std::sync::Arc<dyn crate::adapter::DatabaseAdapter>) -> Option<Vec<TableSchema>> {
    let adapter = adapter.clone();
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(adapter.get_schema().ok());
    });
    rx.recv_timeout(std::time::Duration::from_secs(5)).ok().flatten()
}

fn contains_any(text: &str, keywords: &[&str]) -> bool {
    keywords.iter().any(|kw| text.contains(kw))
}

fn tool_call_response(name: &str, args: &str) -> ChatCompletionResponse {
    ChatCompletionResponse {
        content: None,
        tool_calls: Some(vec![ToolCallInfo {
            id: uuid::Uuid::new_v4().to_string(),
            call_type: "function".to_string(),
            function: FunctionCallInfo {
                name: name.to_string(),
                arguments: args.to_string(),
            },
        }]),
        finish_reason: "tool_calls".to_string(),
    }
}

/// Extract the active connection ID from conversation context.
/// Looks for the most recently mentioned connectionId in tool results,
/// falling back to "conn-1".
fn extract_connection_id(messages: &[ChatMessage]) -> String {
    for msg in messages.iter().rev() {
        if let Some(ref content) = msg.content {
            // Check for connectionId in tool result JSON
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(content) {
                if let Some(id) = v.get("connectionId").and_then(|v| v.as_str()) {
                    return id.to_string();
                }
            }
        }
        // Check in tool_calls arguments
        if let Some(ref calls) = msg.tool_calls {
            for call in calls {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&call.function.arguments) {
                    if let Some(id) = v.get("connectionId").and_then(|v| v.as_str()) {
                        return id.to_string();
                    }
                }
            }
        }
    }
    "conn-1".to_string()
}

/// Try to extract a SQL query from user text. If the message looks like
/// raw SQL (starts with SELECT/INSERT/etc.), return it directly.
fn extract_sql(text: &str) -> Option<String> {
    let trimmed = text.trim();
    let upper = trimmed.to_uppercase();
    if upper.starts_with("SELECT")
        || upper.starts_with("WITH")
        || upper.starts_with("EXPLAIN")
    {
        Some(trimmed.to_string())
    } else {
        None
    }
}

fn parse_saved_query_slash(text: &str) -> Option<(String, serde_json::Value)> {
    let trimmed = text.trim();
    if !trimmed.starts_with('/') || trimmed.len() < 2 {
        return None;
    }

    let tokens: Vec<&str> = trimmed.split_whitespace().collect();
    if tokens.is_empty() {
        return None;
    }

    let query_ref = tokens[0].trim_start_matches('/');
    if query_ref.is_empty() {
        return None;
    }

    let mut params = serde_json::Map::new();
    let mut positional_index = 1;

    for token in tokens.iter().skip(1) {
        if let Some((key, value)) = token.split_once('=') {
            if !key.trim().is_empty() && !value.trim().is_empty() {
                params.insert(key.trim().to_string(), serde_json::json!(value.trim()));
                continue;
            }
        }

        params.insert(
            format!("param{}", positional_index),
            serde_json::json!(token.to_string()),
        );
        positional_index += 1;
    }

    Some((query_ref.to_string(), serde_json::Value::Object(params)))
}

#[tauri::command]
pub fn chat_completion(
    request: ChatCompletionRequest,
    conn_manager: State<'_, ConnectionManager>,
) -> Result<ChatCompletionResponse, AppError> {
    let last_user_raw = request
        .messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .and_then(|m| m.content.as_ref())
        .map(|s| s.to_string())
        .unwrap_or_default();

    if let Some((query_ref, params)) = parse_saved_query_slash(&last_user_raw) {
        return Ok(tool_call_response(
            "execute_saved_query",
            &serde_json::json!({
                "queryRef": query_ref,
                "params": params
            })
            .to_string(),
        ));
    }

    let last_user_msg = request
        .messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .and_then(|m| m.content.as_ref())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    let conn_id = extract_connection_id(&request.messages);

    // Check if the user typed raw SQL
    if let Some(sql) = extract_sql(&last_user_msg) {
        let upper = sql.trim().to_uppercase();
        if upper.starts_with("DELETE")
            || upper.starts_with("DROP")
            || upper.starts_with("TRUNCATE")
            || upper.starts_with("ALTER")
        {
            return Ok(tool_call_response(
                "confirm_action",
                &serde_json::json!({
                    "sql": sql,
                    "description": "This will modify your database. Please confirm."
                })
                .to_string(),
            ));
        }
        return Ok(tool_call_response(
            "execute_query",
            &serde_json::json!({
                "sql": sql,
                "connectionId": conn_id
            })
            .to_string(),
        ));
    }

    // Schema / structure requests
    if contains_any(&last_user_msg, &["schema", "tables", "structure", "columns", "describe"]) {
        return Ok(tool_call_response(
            "get_schema",
            &serde_json::json!({ "connectionId": conn_id }).to_string(),
        ));
    }

    // Query requests — try to generate SQL from intent
    if contains_any(&last_user_msg, &["query", "show me", "find", "count", "how many", "list all", "get all"]) {
        // Attempt to infer which table the user wants
        let table_hint = if let Ok(adapter) = conn_manager.get(&conn_id) {
            quick_schema_lookup(&adapter).and_then(|schema| {
                schema
                    .iter()
                    .find(|t| last_user_msg.contains(&t.name.to_lowercase()))
                    .map(|t| t.name.clone())
            })
        } else {
            None
        };

        let table = table_hint.unwrap_or_else(|| "users".to_string());
        let sql = if contains_any(&last_user_msg, &["count", "how many"]) {
            format!("SELECT COUNT(*) as count FROM {}", table)
        } else {
            format!("SELECT * FROM {} LIMIT 25", table)
        };

        return Ok(tool_call_response(
            "execute_query",
            &serde_json::json!({
                "sql": sql,
                "connectionId": conn_id
            })
            .to_string(),
        ));
    }

    // Insert / form collection
    if contains_any(&last_user_msg, &["insert", "add new", "create row", "add row"]) {
        let table_hint = if let Ok(adapter) = conn_manager.get(&conn_id) {
            quick_schema_lookup(&adapter).and_then(|schema| {
                schema
                    .iter()
                    .find(|t| last_user_msg.contains(&t.name.to_lowercase()))
                    .map(|t| (t.name.clone(), t.columns.iter().filter(|c| !c.primary_key).map(|c| c.name.clone()).collect::<Vec<_>>()))
            })
        } else {
            None
        };

        let (table, columns) = table_hint
            .unwrap_or_else(|| ("users".to_string(), vec!["email".to_string(), "name".to_string(), "active".to_string()]));

        return Ok(tool_call_response(
            "collect_form",
            &serde_json::json!({
                "intent": "insert",
                "table": table,
                "columns": columns
            })
            .to_string(),
        ));
    }

    // Destructive operations
    if contains_any(&last_user_msg, &["delete", "drop", "truncate", "remove row"]) {
        return Ok(tool_call_response(
            "confirm_action",
            &serde_json::json!({
                "sql": "DELETE FROM users WHERE id = 1",
                "description": "Delete a user record"
            })
            .to_string(),
        ));
    }

    // Chart / visualization
    if contains_any(&last_user_msg, &["chart", "visualize", "graph", "plot"]) {
        // If we have a recent query result, we could chart it.
        // For now, prompt user to run a query first, or show sample.
        return Ok(tool_call_response(
            "show_chart",
            &serde_json::json!({
                "chartType": "bar",
                "title": "Query Results",
                "data": [
                    {"name": "Jan", "value": 100},
                    {"name": "Feb", "value": 200},
                    {"name": "Mar", "value": 350},
                    {"name": "Apr", "value": 280}
                ],
                "xKey": "name",
                "yKey": "value"
            })
            .to_string(),
        ));
    }

    // Save query
    if contains_any(&last_user_msg, &["save", "bookmark"]) {
        // Look for the most recent SQL in conversation
        let recent_sql = request
            .messages
            .iter()
            .rev()
            .filter_map(|m| {
                if let Some(ref calls) = m.tool_calls {
                    for call in calls {
                        if call.function.name == "execute_query" {
                            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&call.function.arguments) {
                                return v.get("sql").and_then(|s| s.as_str()).map(|s| s.to_string());
                            }
                        }
                    }
                }
                None
            })
            .next()
            .unwrap_or_else(|| "SELECT 1".to_string());

        return Ok(tool_call_response(
            "save_query",
            &serde_json::json!({
                "name": "Saved Query",
                "description": "User saved query",
                "sql": recent_sql,
                "connectionId": conn_id
            })
            .to_string(),
        ));
    }

    // CSV import
    if contains_any(&last_user_msg, &["import", "csv", "upload"]) {
        return Ok(tool_call_response(
            "import_csv",
            r#"{"tableName":"imported_data"}"#,
        ));
    }

    // Stats / overview
    if contains_any(&last_user_msg, &["stats", "statistics", "overview", "database info"]) {
        return Ok(tool_call_response(
            "get_database_stats",
            &serde_json::json!({ "connectionId": conn_id }).to_string(),
        ));
    }

    // Scan codebase
    if contains_any(&last_user_msg, &["scan", "codebase", "find sql"]) {
        return Ok(tool_call_response(
            "scan_queries",
            r#"{"directoryPath":"."}"#,
        ));
    }

    // Connection setup
    if contains_any(&last_user_msg, &["connect", "setup", "new connection", "add database"]) {
        return Ok(tool_call_response(
            "setup_connection",
            r#"{"existingConnections":[]}"#,
        ));
    }

    // Connection status
    if contains_any(&last_user_msg, &["status", "am i connected", "connection info"]) {
        if let Ok(adapter) = conn_manager.get(&conn_id) {
            let kind = format!("{:?}", adapter.kind());
            return Ok(tool_call_response(
                "show_connection_status",
                &serde_json::json!({
                    "name": conn_id,
                    "dbType": kind,
                    "host": "localhost",
                    "port": 5432,
                    "connected": true
                })
                .to_string(),
            ));
        }
        return Ok(tool_call_response(
            "show_connection_status",
            &serde_json::json!({
                "name": "No active connection",
                "dbType": "Unknown",
                "host": "-",
                "port": 0,
                "connected": false
            })
            .to_string(),
        ));
    }

    // Filter builder
    if contains_any(&last_user_msg, &["filter", "where clause", "build filter"]) {
        let columns = if let Ok(adapter) = conn_manager.get(&conn_id) {
            quick_schema_lookup(&adapter).and_then(|schema| {
                let table = schema.iter()
                    .find(|t| last_user_msg.contains(&t.name.to_lowercase()))
                    .or(schema.first());
                table.map(|t| (t.name.clone(), t.columns.iter().map(|c| serde_json::json!({"name": c.name, "type": c.data_type})).collect::<Vec<_>>()))
            })
        } else {
            None
        };

        let (table, cols) = columns.unwrap_or_else(|| (
            "users".to_string(),
            vec![
                serde_json::json!({"name": "id", "type": "integer"}),
                serde_json::json!({"name": "name", "type": "text"}),
                serde_json::json!({"name": "email", "type": "text"}),
            ]
        ));

        return Ok(tool_call_response(
            "build_filter",
            &serde_json::json!({
                "tableName": table,
                "columns": cols
            })
            .to_string(),
        ));
    }

    // Default response — context-aware help message
    let active_conns = conn_manager.active_ids();
    let status = if active_conns.is_empty() {
        "No databases are currently connected. Go to Connections to connect one."
    } else {
        "Your database is connected and ready."
    };

    Ok(ChatCompletionResponse {
        content: Some(format!(
            "{}\n\nI can help you explore your database. Try asking me to:\n\n\
             - Show the schema\n\
             - Run a query like 'SELECT * FROM users'\n\
             - Run a saved query via '/query-name key=value'\n\
             - View database stats\n\
             - Import a CSV file\n\
             - Visualize data with a chart\n\
             - Save a query to your library",
            status
        )),
        tool_calls: None,
        finish_reason: "stop".to_string(),
    })
}

#[tauri::command]
pub fn get_setting(key: String, db: State<'_, Database>) -> Result<Option<String>, AppError> {
    db.get_setting(&key)
}

#[tauri::command]
pub fn set_setting(key: String, value: String, db: State<'_, Database>) -> Result<(), AppError> {
    db.set_setting(&key, &value)
}
