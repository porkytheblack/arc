// Arc Database Adapter Layer
// RFC: Multi-backend database adapter architecture
//
// This module defines a common trait for all database backends (PostgreSQL,
// MySQL, SQLite, Redis) and provides concrete implementations for each.
// The trait is async-ready and designed for use behind Tauri's managed state.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::Duration;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const QUERY_TIMEOUT: Duration = Duration::from_secs(30);

use crate::commands::{AppError, ColumnInfo, QueryResult, TableSchema};

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/// Describes the flavour of a database backend.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DatabaseKind {
    PostgreSQL,
    MySQL,
    SQLite,
    Redis,
}

impl DatabaseKind {
    pub fn from_str_loose(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "postgresql" | "postgres" | "pg" => Some(Self::PostgreSQL),
            "mysql" | "mariadb" => Some(Self::MySQL),
            "sqlite" | "sqlite3" => Some(Self::SQLite),
            "redis" => Some(Self::Redis),
            _ => None,
        }
    }
}

/// Parameters needed to open a connection to any backend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectParams {
    pub kind: DatabaseKind,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    pub use_ssl: bool,
}

/// Index metadata returned from introspection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexInfo {
    pub name: String,
    pub columns: Vec<String>,
    pub unique: bool,
}

/// Foreign key metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForeignKeyInfo {
    pub name: String,
    pub from_column: String,
    pub to_table: String,
    pub to_column: String,
}

/// Extended table metadata combining schema + indexes + FKs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableMetadata {
    pub schema: TableSchema,
    pub indexes: Vec<IndexInfo>,
    pub foreign_keys: Vec<ForeignKeyInfo>,
}

// ---------------------------------------------------------------------------
// The adapter trait
// ---------------------------------------------------------------------------

/// `DatabaseAdapter` is the core abstraction. Every supported backend
/// implements this trait. All methods are synchronous (called from Tauri
/// command handlers which are sync). Implementations that wrap async drivers
/// use an internal runtime handle.
pub trait DatabaseAdapter: Send + Sync {
    /// Verify that the connection is alive (ping / SELECT 1).
    fn test_connection(&self) -> Result<bool, AppError>;

    /// Retrieve the full schema: tables, columns, types, row counts.
    fn get_schema(&self) -> Result<Vec<TableSchema>, AppError>;

    /// Retrieve extended metadata (indexes, FKs) for a specific table.
    fn get_table_metadata(&self, table: &str) -> Result<TableMetadata, AppError>;

    /// Execute an arbitrary SQL query and return the result set.
    fn execute_query(&self, sql: &str) -> Result<QueryResult, AppError>;

    /// Execute a statement that modifies data (INSERT/UPDATE/DELETE).
    /// Returns the number of affected rows.
    fn execute_statement(&self, sql: &str) -> Result<u64, AppError>;

    /// Return summary statistics: table count, total rows, disk usage.
    fn get_stats(&self) -> Result<AdapterStats, AppError>;

    /// Close the connection / return it to the pool.
    fn disconnect(&self) -> Result<(), AppError>;

    /// Return the backend kind.
    fn kind(&self) -> DatabaseKind;
}

/// Summary statistics returned by `get_stats`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterStats {
    pub table_count: u32,
    pub total_row_count: u64,
    pub disk_usage_bytes: u64,
}

// ---------------------------------------------------------------------------
// PostgreSQL adapter
// ---------------------------------------------------------------------------

pub struct PostgresAdapter {
    client: tokio_postgres::Client,
    runtime: tokio::runtime::Handle,
}

/// Extract the full error message from a tokio_postgres::Error,
/// including the underlying DbError details (severity, message, detail, hint).
fn pg_error_message(e: &tokio_postgres::Error) -> String {
    if let Some(db_err) = e.as_db_error() {
        let mut msg = format!("{}: {}", db_err.severity(), db_err.message());
        if let Some(detail) = db_err.detail() {
            msg.push_str(&format!(" — {}", detail));
        }
        if let Some(hint) = db_err.hint() {
            msg.push_str(&format!(" (hint: {})", hint));
        }
        return msg;
    }
    // Walk the source chain for non-DB errors (e.g. IO errors)
    let mut msg = e.to_string();
    let mut source = std::error::Error::source(e);
    while let Some(cause) = source {
        msg.push_str(&format!(": {}", cause));
        source = cause.source();
    }
    msg
}

impl PostgresAdapter {
    pub fn connect(params: &ConnectParams, rt: tokio::runtime::Handle) -> Result<Self, AppError> {
        // Single-quote and escape values for libpq connection string format.
        // Inside single quotes, backslashes escape the next character.
        fn escape(val: &str) -> String {
            let escaped = val.replace('\\', "\\\\").replace('\'', "\\'");
            format!("'{}'", escaped)
        }

        let sslmode = if params.use_ssl { "require" } else { "disable" };
        let connect_str = format!(
            "host={} port={} dbname={} user={} password={} sslmode={}",
            escape(&params.host),
            params.port,
            escape(&params.database),
            escape(&params.username),
            escape(&params.password),
            sslmode,
        );

        let client = if params.use_ssl {
            let mut root_store = rustls::RootCertStore::empty();
            root_store.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
            let tls_config = rustls::ClientConfig::builder()
                .with_root_certificates(root_store)
                .with_no_client_auth();
            let tls = tokio_postgres_rustls::MakeRustlsConnect::new(tls_config);
            rt.block_on(async {
                let connect_fut = tokio_postgres::connect(&connect_str, tls);
                let (client, connection) = tokio::time::timeout(CONNECT_TIMEOUT, connect_fut)
                    .await
                    .map_err(|_| AppError::ConnectionFailed("Connection timed out".to_string()))?
                    .map_err(|e| AppError::ConnectionFailed(pg_error_message(&e)))?;
                tokio::spawn(async move {
                    if let Err(e) = connection.await {
                        eprintln!("PostgreSQL connection error: {e}");
                    }
                });
                Ok::<_, AppError>(client)
            })?
        } else {
            rt.block_on(async {
                let connect_fut = tokio_postgres::connect(&connect_str, tokio_postgres::NoTls);
                let (client, connection) = tokio::time::timeout(CONNECT_TIMEOUT, connect_fut)
                    .await
                    .map_err(|_| AppError::ConnectionFailed("Connection timed out".to_string()))?
                    .map_err(|e| AppError::ConnectionFailed(pg_error_message(&e)))?;
                tokio::spawn(async move {
                    if let Err(e) = connection.await {
                        eprintln!("PostgreSQL connection error: {e}");
                    }
                });
                Ok::<_, AppError>(client)
            })?
        };

        Ok(Self { client, runtime: rt })
    }
}

impl DatabaseAdapter for PostgresAdapter {
    fn kind(&self) -> DatabaseKind {
        DatabaseKind::PostgreSQL
    }

    fn test_connection(&self) -> Result<bool, AppError> {
        self.runtime
            .block_on(async {
                tokio::time::timeout(QUERY_TIMEOUT, async {
                    self.client
                        .simple_query("SELECT 1")
                        .await
                        .map(|_| true)
                        .map_err(|e| AppError::ConnectionFailed(e.to_string()))
                })
                .await
                .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
            })
    }

    fn get_schema(&self) -> Result<Vec<TableSchema>, AppError> {
        self.runtime.block_on(async {
            tokio::time::timeout(QUERY_TIMEOUT, async {
                let rows = self
                    .client
                    .query(
                        "SELECT table_name FROM information_schema.tables
                         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                         ORDER BY table_name",
                        &[],
                    )
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let mut tables = Vec::new();
                for row in &rows {
                    let table_name: String = row.try_get(0).unwrap_or_default();

                    let col_rows = self
                        .client
                        .query(
                            "SELECT c.column_name, c.data_type, c.is_nullable,
                                    CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_pk
                             FROM information_schema.columns c
                             LEFT JOIN (
                                 SELECT kcu.column_name
                                 FROM information_schema.table_constraints tc
                                 JOIN information_schema.key_column_usage kcu
                                     ON tc.constraint_name = kcu.constraint_name
                                 WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
                             ) pk ON pk.column_name = c.column_name
                             WHERE c.table_name = $1 AND c.table_schema = 'public'
                             ORDER BY c.ordinal_position",
                            &[&table_name],
                        )
                        .await
                        .map_err(|e| AppError::QueryError(e.to_string()))?;

                    let columns: Vec<ColumnInfo> = col_rows
                        .iter()
                        .map(|r| ColumnInfo {
                            name: r.try_get(0).unwrap_or_default(),
                            data_type: r.try_get(1).unwrap_or_default(),
                            nullable: r.try_get::<_, String>(2).unwrap_or_default() == "YES",
                            primary_key: r.try_get(3).unwrap_or(false),
                        })
                        .collect();

                    let row_count: i64 = self
                        .client
                        .query_one(
                            "SELECT COALESCE(reltuples, 0)::bigint FROM pg_class WHERE relname = $1",
                            &[&table_name],
                        )
                        .await
                        .ok()
                        .and_then(|r| r.try_get(0).ok())
                        .unwrap_or(0);

                    tables.push(TableSchema {
                        name: table_name,
                        columns,
                        row_count: row_count.max(0) as u64,
                    });
                }

                Ok(tables)
            })
            .await
            .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
        })
    }

    fn get_table_metadata(&self, table: &str) -> Result<TableMetadata, AppError> {
        let schema_tables = self.get_schema()?;
        let table_schema = schema_tables
            .into_iter()
            .find(|t| t.name == table)
            .ok_or_else(|| AppError::NotFound(format!("Table {table} not found")))?;

        let table_name = table.to_string();
        self.runtime.block_on(async {
            tokio::time::timeout(QUERY_TIMEOUT, async {
                let idx_rows = self
                    .client
                    .query(
                        "SELECT i.relname, array_agg(a.attname ORDER BY x.n), ix.indisunique
                         FROM pg_index ix
                         JOIN pg_class t ON t.oid = ix.indrelid
                         JOIN pg_class i ON i.oid = ix.indexrelid
                         JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS x(attnum, n) ON true
                         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
                         WHERE t.relname = $1
                         GROUP BY i.relname, ix.indisunique",
                        &[&table_name],
                    )
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let indexes: Vec<IndexInfo> = idx_rows
                    .iter()
                    .map(|r| IndexInfo {
                        name: r.get(0),
                        columns: r.get(1),
                        unique: r.get(2),
                    })
                    .collect();

                let fk_rows = self
                    .client
                    .query(
                        "SELECT tc.constraint_name, kcu.column_name, ccu.table_name, ccu.column_name
                         FROM information_schema.table_constraints tc
                         JOIN information_schema.key_column_usage kcu
                             ON tc.constraint_name = kcu.constraint_name
                         JOIN information_schema.constraint_column_usage ccu
                             ON tc.constraint_name = ccu.constraint_name
                         WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'",
                        &[&table_name],
                    )
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let foreign_keys: Vec<ForeignKeyInfo> = fk_rows
                    .iter()
                    .map(|r| ForeignKeyInfo {
                        name: r.get(0),
                        from_column: r.get(1),
                        to_table: r.get(2),
                        to_column: r.get(3),
                    })
                    .collect();

                Ok(TableMetadata {
                    schema: table_schema,
                    indexes,
                    foreign_keys,
                })
            })
            .await
            .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
        })
    }

    fn execute_query(&self, sql: &str) -> Result<QueryResult, AppError> {
        let sql = sql.to_string();
        self.runtime.block_on(async {
            tokio::time::timeout(QUERY_TIMEOUT, async {
                let start = std::time::Instant::now();
                let stmt = self
                    .client
                    .prepare(&sql)
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let rows = self
                    .client
                    .query(&stmt, &[])
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let elapsed = start.elapsed().as_millis() as u64;

                let columns: Vec<String> = stmt.columns().iter().map(|c| c.name().to_string()).collect();

                let mut result_rows: Vec<Vec<serde_json::Value>> = Vec::new();
                for row in &rows {
                    let mut values = Vec::new();
                    for (i, col) in stmt.columns().iter().enumerate() {
                        let value = pg_value_to_json(row, i, col.type_());
                        values.push(value);
                    }
                    result_rows.push(values);
                }

                let row_count = result_rows.len();
                Ok(QueryResult {
                    columns,
                    rows: result_rows,
                    row_count,
                    execution_time_ms: elapsed,
                })
            })
            .await
            .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
        })
    }

    fn execute_statement(&self, sql: &str) -> Result<u64, AppError> {
        let sql = sql.to_string();
        self.runtime.block_on(async {
            tokio::time::timeout(QUERY_TIMEOUT, async {
                self.client
                    .execute(&sql, &[])
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))
            })
            .await
            .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
        })
    }

    fn get_stats(&self) -> Result<AdapterStats, AppError> {
        self.runtime.block_on(async {
            tokio::time::timeout(QUERY_TIMEOUT, async {
                let row = self
                    .client
                    .query_one(
                        "SELECT
                            (SELECT count(*)::bigint FROM information_schema.tables
                             WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as table_count,
                            (SELECT COALESCE(sum(reltuples), 0)::bigint FROM pg_class
                             JOIN pg_namespace ON pg_namespace.oid = relnamespace
                             WHERE nspname = 'public' AND relkind = 'r') as total_rows,
                            (SELECT pg_database_size(current_database())::bigint) as disk_usage",
                        &[],
                    )
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                Ok(AdapterStats {
                    table_count: row.try_get::<_, i64>(0).unwrap_or(0) as u32,
                    total_row_count: row.try_get::<_, i64>(1).unwrap_or(0) as u64,
                    disk_usage_bytes: row.try_get::<_, i64>(2).unwrap_or(0) as u64,
                })
            })
            .await
            .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
        })
    }

    fn disconnect(&self) -> Result<(), AppError> {
        // tokio-postgres Client doesn't have an explicit close; dropping does it.
        Ok(())
    }
}

/// Convert a postgres row value to serde_json::Value based on column type.
fn pg_value_to_json(
    row: &tokio_postgres::Row,
    idx: usize,
    col_type: &tokio_postgres::types::Type,
) -> serde_json::Value {
    use tokio_postgres::types::Type;

    // Try the common types; fall back to string representation
    match *col_type {
        Type::BOOL => row
            .try_get::<_, bool>(idx)
            .ok()
            .map(serde_json::Value::Bool)
            .unwrap_or(serde_json::Value::Null),
        Type::INT2 => row
            .try_get::<_, i16>(idx)
            .ok()
            .map(|v| serde_json::Value::Number(v.into()))
            .unwrap_or(serde_json::Value::Null),
        Type::INT4 => row
            .try_get::<_, i32>(idx)
            .ok()
            .map(|v| serde_json::Value::Number(v.into()))
            .unwrap_or(serde_json::Value::Null),
        Type::INT8 => row
            .try_get::<_, i64>(idx)
            .ok()
            .map(|v| serde_json::Value::Number(v.into()))
            .unwrap_or(serde_json::Value::Null),
        Type::FLOAT4 => row
            .try_get::<_, f32>(idx)
            .ok()
            .and_then(|v| serde_json::Number::from_f64(v as f64))
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        Type::FLOAT8 => row
            .try_get::<_, f64>(idx)
            .ok()
            .and_then(serde_json::Number::from_f64)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        Type::TEXT | Type::VARCHAR | Type::NAME | Type::BPCHAR => row
            .try_get::<_, String>(idx)
            .ok()
            .map(serde_json::Value::String)
            .unwrap_or(serde_json::Value::Null),
        _ => {
            // Fallback: try as string
            row.try_get::<_, String>(idx)
                .ok()
                .map(serde_json::Value::String)
                .unwrap_or(serde_json::Value::Null)
        }
    }
}

// ---------------------------------------------------------------------------
// MySQL adapter
// ---------------------------------------------------------------------------

pub struct MySqlAdapter {
    pool: mysql_async::Pool,
    runtime: tokio::runtime::Handle,
    database: String,
}

impl MySqlAdapter {
    pub fn connect(params: &ConnectParams, rt: tokio::runtime::Handle) -> Result<Self, AppError> {
        let url = format!(
            "mysql://{}:{}@{}:{}/{}",
            params.username, params.password, params.host, params.port, params.database
        );
        let pool = mysql_async::Pool::new(url.as_str());

        // Test the connection with timeout
        rt.block_on(async {
            let conn = tokio::time::timeout(CONNECT_TIMEOUT, pool.get_conn())
                .await
                .map_err(|_| AppError::ConnectionFailed("Connection timed out".to_string()))?
                .map_err(|e| AppError::ConnectionFailed(e.to_string()))?;
            drop(conn);
            Ok::<(), AppError>(())
        })?;

        Ok(Self {
            pool,
            runtime: rt,
            database: params.database.clone(),
        })
    }
}

impl DatabaseAdapter for MySqlAdapter {
    fn kind(&self) -> DatabaseKind {
        DatabaseKind::MySQL
    }

    fn test_connection(&self) -> Result<bool, AppError> {
        self.runtime.block_on(async {
            tokio::time::timeout(QUERY_TIMEOUT, async {
                use mysql_async::prelude::Queryable;
                let mut conn = self
                    .pool
                    .get_conn()
                    .await
                    .map_err(|e| AppError::ConnectionFailed(e.to_string()))?;
                conn.query_drop("SELECT 1")
                    .await
                    .map_err(|e| AppError::ConnectionFailed(e.to_string()))?;
                Ok(true)
            })
            .await
            .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
        })
    }

    fn get_schema(&self) -> Result<Vec<TableSchema>, AppError> {
        let db = self.database.clone();
        self.runtime.block_on(async {
            tokio::time::timeout(QUERY_TIMEOUT, async {
                use mysql_async::prelude::Queryable;
                let mut conn = self
                    .pool
                    .get_conn()
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let table_names: Vec<String> = conn
                    .query(format!(
                        "SELECT table_name FROM information_schema.tables
                         WHERE table_schema = '{}' AND table_type = 'BASE TABLE'
                         ORDER BY table_name",
                        db
                    ))
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let mut tables = Vec::new();
                for table_name in table_names {
                    let col_rows: Vec<(String, String, String, String)> = conn
                        .query(format!(
                            "SELECT column_name, column_type, is_nullable, column_key
                             FROM information_schema.columns
                             WHERE table_schema = '{}' AND table_name = '{}'
                             ORDER BY ordinal_position",
                            db, table_name
                        ))
                        .await
                        .map_err(|e| AppError::QueryError(e.to_string()))?;

                    let columns: Vec<ColumnInfo> = col_rows
                        .iter()
                        .map(|(name, dtype, nullable, key)| ColumnInfo {
                            name: name.clone(),
                            data_type: dtype.clone(),
                            nullable: nullable == "YES",
                            primary_key: key == "PRI",
                        })
                        .collect();

                    let count: Vec<u64> = conn
                        .query(format!(
                            "SELECT table_rows FROM information_schema.tables
                             WHERE table_schema = '{}' AND table_name = '{}'",
                            db, table_name
                        ))
                        .await
                        .map_err(|e| AppError::QueryError(e.to_string()))?;

                    let row_count = count.first().copied().unwrap_or(0);

                    tables.push(TableSchema {
                        name: table_name,
                        columns,
                        row_count,
                    });
                }
                Ok(tables)
            })
            .await
            .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
        })
    }

    fn get_table_metadata(&self, table: &str) -> Result<TableMetadata, AppError> {
        let schema_tables = self.get_schema()?;
        let table_schema = schema_tables
            .into_iter()
            .find(|t| t.name == table)
            .ok_or_else(|| AppError::NotFound(format!("Table {table} not found")))?;

        let db = self.database.clone();
        let table_name = table.to_string();
        self.runtime.block_on(async {
            tokio::time::timeout(QUERY_TIMEOUT, async {
                use mysql_async::prelude::Queryable;
                let mut conn = self
                    .pool
                    .get_conn()
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let idx_rows: Vec<(String, String, i32)> = conn
                    .query(format!(
                        "SELECT index_name, column_name, non_unique
                         FROM information_schema.statistics
                         WHERE table_schema = '{}' AND table_name = '{}'
                         ORDER BY index_name, seq_in_index",
                        db, table_name
                    ))
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let mut idx_map: HashMap<String, (Vec<String>, bool)> = HashMap::new();
                for (name, col, non_unique) in &idx_rows {
                    let entry = idx_map.entry(name.clone()).or_insert((Vec::new(), *non_unique == 0));
                    entry.0.push(col.clone());
                }
                let indexes: Vec<IndexInfo> = idx_map
                    .into_iter()
                    .map(|(name, (columns, unique))| IndexInfo { name, columns, unique })
                    .collect();

                let fk_rows: Vec<(String, String, String, String)> = conn
                    .query(format!(
                        "SELECT constraint_name, column_name, referenced_table_name, referenced_column_name
                         FROM information_schema.key_column_usage
                         WHERE table_schema = '{}' AND table_name = '{}' AND referenced_table_name IS NOT NULL",
                        db, table_name
                    ))
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let foreign_keys: Vec<ForeignKeyInfo> = fk_rows
                    .iter()
                    .map(|(name, col, ref_table, ref_col)| ForeignKeyInfo {
                        name: name.clone(),
                        from_column: col.clone(),
                        to_table: ref_table.clone(),
                        to_column: ref_col.clone(),
                    })
                    .collect();

                Ok(TableMetadata {
                    schema: table_schema,
                    indexes,
                    foreign_keys,
                })
            })
            .await
            .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
        })
    }

    fn execute_query(&self, sql: &str) -> Result<QueryResult, AppError> {
        let sql = sql.to_string();
        self.runtime.block_on(async {
            tokio::time::timeout(QUERY_TIMEOUT, async {
                use mysql_async::prelude::Queryable;
                let mut conn = self
                    .pool
                    .get_conn()
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let start = std::time::Instant::now();
                let result: Vec<mysql_async::Row> = conn
                    .query(&sql)
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let elapsed = start.elapsed().as_millis() as u64;

                if result.is_empty() {
                    return Ok(QueryResult {
                        columns: vec![],
                        rows: vec![],
                        row_count: 0,
                        execution_time_ms: elapsed,
                    });
                }

                let columns: Vec<String> = result[0]
                    .columns_ref()
                    .iter()
                    .map(|c| c.name_str().to_string())
                    .collect();

                let mut rows = Vec::new();
                for row in &result {
                    let mut values = Vec::new();
                    for i in 0..columns.len() {
                        let val: mysql_async::Value = row.get(i).unwrap_or(mysql_async::Value::NULL);
                        values.push(mysql_value_to_json(val));
                    }
                    rows.push(values);
                }

                let row_count = rows.len();
                Ok(QueryResult {
                    columns,
                    rows,
                    row_count,
                    execution_time_ms: elapsed,
                })
            })
            .await
            .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
        })
    }

    fn execute_statement(&self, sql: &str) -> Result<u64, AppError> {
        let sql = sql.to_string();
        self.runtime.block_on(async {
            tokio::time::timeout(QUERY_TIMEOUT, async {
                use mysql_async::prelude::Queryable;
                let mut conn = self
                    .pool
                    .get_conn()
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;
                let result = conn
                    .query_iter(&sql)
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;
                let affected = result.affected_rows();
                drop(result);
                Ok(affected)
            })
            .await
            .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
        })
    }

    fn get_stats(&self) -> Result<AdapterStats, AppError> {
        let db = self.database.clone();
        self.runtime.block_on(async {
            tokio::time::timeout(QUERY_TIMEOUT, async {
                use mysql_async::prelude::Queryable;
                let mut conn = self
                    .pool
                    .get_conn()
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let rows: Vec<(u64, u64, u64)> = conn
                    .query(format!(
                        "SELECT COUNT(*), IFNULL(SUM(table_rows), 0), IFNULL(SUM(data_length + index_length), 0)
                         FROM information_schema.tables
                         WHERE table_schema = '{}'",
                        db
                    ))
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let (table_count, total_rows, disk_usage) =
                    rows.first().copied().unwrap_or((0, 0, 0));

                Ok(AdapterStats {
                    table_count: table_count as u32,
                    total_row_count: total_rows,
                    disk_usage_bytes: disk_usage,
                })
            })
            .await
            .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
        })
    }

    fn disconnect(&self) -> Result<(), AppError> {
        let pool = self.pool.clone();
        self.runtime.block_on(async {
            tokio::time::timeout(QUERY_TIMEOUT, async {
                pool.disconnect()
                    .await
                    .map_err(|e| AppError::ConnectionFailed(e.to_string()))
            })
            .await
            .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
        })
    }
}

fn mysql_value_to_json(val: mysql_async::Value) -> serde_json::Value {
    match val {
        mysql_async::Value::NULL => serde_json::Value::Null,
        mysql_async::Value::Int(i) => serde_json::Value::Number(i.into()),
        mysql_async::Value::UInt(u) => serde_json::Value::Number(u.into()),
        mysql_async::Value::Float(f) => serde_json::Number::from_f64(f as f64)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        mysql_async::Value::Double(f) => serde_json::Number::from_f64(f)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        mysql_async::Value::Bytes(b) => {
            String::from_utf8(b)
                .map(serde_json::Value::String)
                .unwrap_or(serde_json::Value::Null)
        }
        _ => serde_json::Value::String(format!("{:?}", val)),
    }
}

// ---------------------------------------------------------------------------
// SQLite adapter (user databases, not the app's internal SQLite)
// ---------------------------------------------------------------------------

pub struct SqliteAdapter {
    conn: std::sync::Mutex<rusqlite::Connection>,
}

impl SqliteAdapter {
    pub fn connect(params: &ConnectParams) -> Result<Self, AppError> {
        // For SQLite, `database` field is the file path
        let connection = rusqlite::Connection::open(&params.database)
            .map_err(|e| AppError::ConnectionFailed(e.to_string()))?;

        connection
            .execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=30000;")
            .map_err(|e| AppError::ConnectionFailed(e.to_string()))?;

        Ok(Self {
            conn: std::sync::Mutex::new(connection),
        })
    }
}

impl DatabaseAdapter for SqliteAdapter {
    fn kind(&self) -> DatabaseKind {
        DatabaseKind::SQLite
    }

    fn test_connection(&self) -> Result<bool, AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("SELECT 1")
            .map(|_| true)
            .map_err(|e| AppError::ConnectionFailed(e.to_string()))
    }

    fn get_schema(&self) -> Result<Vec<TableSchema>, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            .map_err(|e| AppError::QueryError(e.to_string()))?;

        let table_names: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| AppError::QueryError(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        let mut tables = Vec::new();
        for table_name in &table_names {
            let mut pragma_stmt = conn
                .prepare(&format!("PRAGMA table_info(\"{}\")", table_name))
                .map_err(|e| AppError::QueryError(e.to_string()))?;

            let columns: Vec<ColumnInfo> = pragma_stmt
                .query_map([], |row| {
                    Ok(ColumnInfo {
                        name: row.get(1)?,
                        data_type: row.get(2)?,
                        nullable: row.get::<_, i32>(3)? == 0,
                        primary_key: row.get::<_, i32>(5)? > 0,
                    })
                })
                .map_err(|e| AppError::QueryError(e.to_string()))?
                .filter_map(|r| r.ok())
                .collect();

            let count: u64 = conn
                .query_row(
                    &format!("SELECT COUNT(*) FROM \"{}\"", table_name),
                    [],
                    |row| row.get(0),
                )
                .unwrap_or(0);

            tables.push(TableSchema {
                name: table_name.clone(),
                columns,
                row_count: count,
            });
        }

        Ok(tables)
    }

    fn get_table_metadata(&self, table: &str) -> Result<TableMetadata, AppError> {
        let schema_tables = self.get_schema()?;
        let table_schema = schema_tables
            .into_iter()
            .find(|t| t.name == table)
            .ok_or_else(|| AppError::NotFound(format!("Table {table} not found")))?;

        let conn = self.conn.lock().unwrap();

        // Indexes
        let mut idx_stmt = conn
            .prepare(&format!("PRAGMA index_list(\"{}\")", table))
            .map_err(|e| AppError::QueryError(e.to_string()))?;

        let idx_info: Vec<(String, bool)> = idx_stmt
            .query_map([], |row| Ok((row.get(1)?, row.get::<_, i32>(2)? == 1)))
            .map_err(|e| AppError::QueryError(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        let mut indexes = Vec::new();
        for (idx_name, unique) in &idx_info {
            let mut info_stmt = conn
                .prepare(&format!("PRAGMA index_info(\"{}\")", idx_name))
                .map_err(|e| AppError::QueryError(e.to_string()))?;

            let cols: Vec<String> = info_stmt
                .query_map([], |row| row.get(2))
                .map_err(|e| AppError::QueryError(e.to_string()))?
                .filter_map(|r| r.ok())
                .collect();

            indexes.push(IndexInfo {
                name: idx_name.clone(),
                columns: cols,
                unique: *unique,
            });
        }

        // Foreign keys
        let mut fk_stmt = conn
            .prepare(&format!("PRAGMA foreign_key_list(\"{}\")", table))
            .map_err(|e| AppError::QueryError(e.to_string()))?;

        let foreign_keys: Vec<ForeignKeyInfo> = fk_stmt
            .query_map([], |row| {
                Ok(ForeignKeyInfo {
                    name: format!("fk_{}", row.get::<_, i32>(0)?),
                    from_column: row.get(3)?,
                    to_table: row.get(2)?,
                    to_column: row.get(4)?,
                })
            })
            .map_err(|e| AppError::QueryError(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(TableMetadata {
            schema: table_schema,
            indexes,
            foreign_keys,
        })
    }

    fn execute_query(&self, sql: &str) -> Result<QueryResult, AppError> {
        let conn = self.conn.lock().unwrap();
        let start = std::time::Instant::now();

        let mut stmt = conn
            .prepare(sql)
            .map_err(|e| AppError::QueryError(e.to_string()))?;

        let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

        let rows: Vec<Vec<serde_json::Value>> = stmt
            .query_map([], |row| {
                let mut values = Vec::new();
                for i in 0..columns.len() {
                    let val = sqlite_value_to_json(row, i);
                    values.push(val);
                }
                Ok(values)
            })
            .map_err(|e| AppError::QueryError(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        let elapsed = start.elapsed().as_millis() as u64;
        let row_count = rows.len();

        Ok(QueryResult {
            columns,
            rows,
            row_count,
            execution_time_ms: elapsed,
        })
    }

    fn execute_statement(&self, sql: &str) -> Result<u64, AppError> {
        let conn = self.conn.lock().unwrap();
        let affected = conn
            .execute(sql, [])
            .map_err(|e| AppError::QueryError(e.to_string()))?;
        Ok(affected as u64)
    }

    fn get_stats(&self) -> Result<AdapterStats, AppError> {
        let schema = self.get_schema()?;
        let table_count = schema.len() as u32;
        let total_row_count: u64 = schema.iter().map(|t| t.row_count).sum();

        let conn = self.conn.lock().unwrap();
        let page_count: u64 = conn
            .query_row("PRAGMA page_count", [], |row| row.get(0))
            .unwrap_or(0);
        let page_size: u64 = conn
            .query_row("PRAGMA page_size", [], |row| row.get(0))
            .unwrap_or(4096);

        Ok(AdapterStats {
            table_count,
            total_row_count,
            disk_usage_bytes: page_count * page_size,
        })
    }

    fn disconnect(&self) -> Result<(), AppError> {
        Ok(())
    }
}

fn sqlite_value_to_json(row: &rusqlite::Row, idx: usize) -> serde_json::Value {
    // rusqlite ValueRef enum
    use rusqlite::types::ValueRef;
    match row.get_ref(idx) {
        Ok(ValueRef::Null) => serde_json::Value::Null,
        Ok(ValueRef::Integer(i)) => serde_json::Value::Number(i.into()),
        Ok(ValueRef::Real(f)) => serde_json::Number::from_f64(f)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        Ok(ValueRef::Text(t)) => {
            serde_json::Value::String(String::from_utf8_lossy(t).to_string())
        }
        Ok(ValueRef::Blob(b)) => {
            serde_json::Value::String(format!("<blob {} bytes>", b.len()))
        }
        Err(_) => serde_json::Value::Null,
    }
}

// ---------------------------------------------------------------------------
// Redis adapter — key-value mapped to a relational-style interface
// ---------------------------------------------------------------------------

pub struct RedisAdapter {
    client: redis::Client,
    runtime: tokio::runtime::Handle,
}

impl RedisAdapter {
    pub fn connect(params: &ConnectParams, rt: tokio::runtime::Handle) -> Result<Self, AppError> {
        let url = if params.password.is_empty() {
            format!("redis://{}:{}", params.host, params.port)
        } else {
            format!("redis://:{}@{}:{}", params.password, params.host, params.port)
        };

        let client = redis::Client::open(url.as_str())
            .map_err(|e| AppError::ConnectionFailed(e.to_string()))?;

        // Test connectivity with timeout
        rt.block_on(async {
            let mut conn = tokio::time::timeout(CONNECT_TIMEOUT, client.get_multiplexed_async_connection())
                .await
                .map_err(|_| AppError::ConnectionFailed("Connection timed out".to_string()))?
                .map_err(|e| AppError::ConnectionFailed(e.to_string()))?;
            tokio::time::timeout(CONNECT_TIMEOUT, redis::cmd("PING").query_async::<String>(&mut conn))
                .await
                .map_err(|_| AppError::ConnectionFailed("Connection timed out".to_string()))?
                .map_err(|e| AppError::ConnectionFailed(e.to_string()))?;
            Ok::<(), AppError>(())
        })?;

        Ok(Self { client, runtime: rt })
    }
}

impl DatabaseAdapter for RedisAdapter {
    fn kind(&self) -> DatabaseKind {
        DatabaseKind::Redis
    }

    fn test_connection(&self) -> Result<bool, AppError> {
        self.runtime.block_on(async {
            tokio::time::timeout(QUERY_TIMEOUT, async {
                let mut conn = self
                    .client
                    .get_multiplexed_async_connection()
                    .await
                    .map_err(|e| AppError::ConnectionFailed(e.to_string()))?;
                redis::cmd("PING")
                    .query_async::<String>(&mut conn)
                    .await
                    .map(|_| true)
                    .map_err(|e| AppError::ConnectionFailed(e.to_string()))
            })
            .await
            .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
        })
    }

    fn get_schema(&self) -> Result<Vec<TableSchema>, AppError> {
        self.runtime.block_on(async {
            tokio::time::timeout(QUERY_TIMEOUT, async {
                let mut conn = self
                    .client
                    .get_multiplexed_async_connection()
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let db_size: u64 = redis::cmd("DBSIZE")
                    .query_async(&mut conn)
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                Ok(vec![TableSchema {
                    name: "keys".to_string(),
                    columns: vec![
                        ColumnInfo {
                            name: "key".to_string(),
                            data_type: "string".to_string(),
                            nullable: false,
                            primary_key: true,
                        },
                        ColumnInfo {
                            name: "value".to_string(),
                            data_type: "string".to_string(),
                            nullable: true,
                            primary_key: false,
                        },
                        ColumnInfo {
                            name: "type".to_string(),
                            data_type: "string".to_string(),
                            nullable: false,
                            primary_key: false,
                        },
                        ColumnInfo {
                            name: "ttl".to_string(),
                            data_type: "integer".to_string(),
                            nullable: true,
                            primary_key: false,
                        },
                    ],
                    row_count: db_size,
                }])
            })
            .await
            .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
        })
    }

    fn get_table_metadata(&self, _table: &str) -> Result<TableMetadata, AppError> {
        let schema = self.get_schema()?;
        Ok(TableMetadata {
            schema: schema.into_iter().next().unwrap(),
            indexes: vec![],
            foreign_keys: vec![],
        })
    }

    fn execute_query(&self, sql: &str) -> Result<QueryResult, AppError> {
        // Redis "queries" are interpreted as key pattern scans
        // Syntax: SCAN <pattern> or GET <key> or KEYS <pattern>
        let sql = sql.trim();
        self.runtime.block_on(async {
            tokio::time::timeout(QUERY_TIMEOUT, async {
                let mut conn = self
                    .client
                    .get_multiplexed_async_connection()
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let start = std::time::Instant::now();

                let parts: Vec<&str> = sql.splitn(2, ' ').collect();
                let cmd = parts.first().map(|s| s.to_uppercase()).unwrap_or_default();
                let arg = parts.get(1).map(|s| s.trim()).unwrap_or("*");

                match cmd.as_str() {
                    "KEYS" | "SCAN" | "SELECT" => {
                        let pattern = if cmd == "SELECT" { "*" } else { arg };
                        let keys: Vec<String> = redis::cmd("KEYS")
                            .arg(pattern)
                            .query_async(&mut conn)
                            .await
                            .map_err(|e| AppError::QueryError(e.to_string()))?;

                        let mut rows = Vec::new();
                        for key in keys.iter().take(100) {
                            let key_type: String = redis::cmd("TYPE")
                                .arg(key.as_str())
                                .query_async(&mut conn)
                                .await
                                .unwrap_or_else(|_| "unknown".to_string());

                            let value: String = match key_type.as_str() {
                                "string" => redis::cmd("GET")
                                    .arg(key.as_str())
                                    .query_async(&mut conn)
                                    .await
                                    .unwrap_or_else(|_| "<error>".to_string()),
                                "list" => {
                                    let len: i64 = redis::cmd("LLEN")
                                        .arg(key.as_str())
                                        .query_async(&mut conn)
                                        .await
                                        .unwrap_or(0);
                                    format!("<list: {} items>", len)
                                }
                                "set" => {
                                    let len: i64 = redis::cmd("SCARD")
                                        .arg(key.as_str())
                                        .query_async(&mut conn)
                                        .await
                                        .unwrap_or(0);
                                    format!("<set: {} members>", len)
                                }
                                "hash" => {
                                    let len: i64 = redis::cmd("HLEN")
                                        .arg(key.as_str())
                                        .query_async(&mut conn)
                                        .await
                                        .unwrap_or(0);
                                    format!("<hash: {} fields>", len)
                                }
                                _ => format!("<{}>", key_type),
                            };

                            let ttl: i64 = redis::cmd("TTL")
                                .arg(key.as_str())
                                .query_async(&mut conn)
                                .await
                                .unwrap_or(-1);

                            rows.push(vec![
                                serde_json::Value::String(key.clone()),
                                serde_json::Value::String(value),
                                serde_json::Value::String(key_type),
                                if ttl >= 0 {
                                    serde_json::Value::Number(ttl.into())
                                } else {
                                    serde_json::Value::Null
                                },
                            ]);
                        }

                        let elapsed = start.elapsed().as_millis() as u64;
                        let row_count = rows.len();

                        Ok(QueryResult {
                            columns: vec![
                                "key".to_string(),
                                "value".to_string(),
                                "type".to_string(),
                                "ttl".to_string(),
                            ],
                            rows,
                            row_count,
                            execution_time_ms: elapsed,
                        })
                    }
                    "GET" => {
                        let val: Option<String> = redis::cmd("GET")
                            .arg(arg)
                            .query_async(&mut conn)
                            .await
                            .ok();
                        let elapsed = start.elapsed().as_millis() as u64;
                        Ok(QueryResult {
                            columns: vec!["key".to_string(), "value".to_string()],
                            rows: vec![vec![
                                serde_json::Value::String(arg.to_string()),
                                val.map(serde_json::Value::String)
                                    .unwrap_or(serde_json::Value::Null),
                            ]],
                            row_count: 1,
                            execution_time_ms: elapsed,
                        })
                    }
                    _ => Err(AppError::QueryError(format!(
                        "Unsupported Redis command: {}. Use KEYS, SCAN, GET, or SELECT.",
                        cmd
                    ))),
                }
            })
            .await
            .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
        })
    }

    fn execute_statement(&self, sql: &str) -> Result<u64, AppError> {
        let sql = sql.trim();
        self.runtime.block_on(async {
            tokio::time::timeout(QUERY_TIMEOUT, async {
                let mut conn = self
                    .client
                    .get_multiplexed_async_connection()
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let parts: Vec<&str> = sql.splitn(3, ' ').collect();
                let cmd = parts.first().map(|s| s.to_uppercase()).unwrap_or_default();

                match cmd.as_str() {
                    "SET" => {
                        let key = parts.get(1).unwrap_or(&"");
                        let val = parts.get(2).unwrap_or(&"");
                        redis::cmd("SET")
                            .arg(*key)
                            .arg(*val)
                            .query_async::<String>(&mut conn)
                            .await
                            .map_err(|e| AppError::QueryError(e.to_string()))?;
                        Ok(1)
                    }
                    "DEL" | "DELETE" => {
                        let key = parts.get(1).unwrap_or(&"");
                        let deleted: u64 = redis::cmd("DEL")
                            .arg(*key)
                            .query_async(&mut conn)
                            .await
                            .map_err(|e| AppError::QueryError(e.to_string()))?;
                        Ok(deleted)
                    }
                    _ => Err(AppError::QueryError(format!(
                        "Unsupported Redis write command: {}. Use SET or DEL.",
                        cmd
                    ))),
                }
            })
            .await
            .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
        })
    }

    fn get_stats(&self) -> Result<AdapterStats, AppError> {
        self.runtime.block_on(async {
            tokio::time::timeout(QUERY_TIMEOUT, async {
                let mut conn = self
                    .client
                    .get_multiplexed_async_connection()
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let db_size: u64 = redis::cmd("DBSIZE")
                    .query_async(&mut conn)
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let info: String = redis::cmd("INFO")
                    .arg("memory")
                    .query_async(&mut conn)
                    .await
                    .map_err(|e| AppError::QueryError(e.to_string()))?;

                let memory_bytes = info
                    .lines()
                    .find(|l| l.starts_with("used_memory:"))
                    .and_then(|l| l.split(':').nth(1))
                    .and_then(|v| v.trim().parse::<u64>().ok())
                    .unwrap_or(0);

                Ok(AdapterStats {
                    table_count: 1,
                    total_row_count: db_size,
                    disk_usage_bytes: memory_bytes,
                })
            })
            .await
            .map_err(|_| AppError::ConnectionFailed("Operation timed out".to_string()))?
        })
    }

    fn disconnect(&self) -> Result<(), AppError> {
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Connection Manager — manages active adapters by connection ID
// ---------------------------------------------------------------------------

pub struct ConnectionManager {
    connections: RwLock<HashMap<String, Arc<dyn DatabaseAdapter>>>,
    runtime: tokio::runtime::Handle,
}

impl ConnectionManager {
    pub fn new(runtime: tokio::runtime::Handle) -> Self {
        Self {
            connections: RwLock::new(HashMap::new()),
            runtime,
        }
    }

    /// Open and register a new connection.
    pub fn connect(&self, id: &str, params: &ConnectParams) -> Result<(), AppError> {
        let adapter: Arc<dyn DatabaseAdapter> = match params.kind {
            DatabaseKind::PostgreSQL => {
                Arc::new(PostgresAdapter::connect(params, self.runtime.clone())?)
            }
            DatabaseKind::MySQL => {
                Arc::new(MySqlAdapter::connect(params, self.runtime.clone())?)
            }
            DatabaseKind::SQLite => Arc::new(SqliteAdapter::connect(params)?),
            DatabaseKind::Redis => {
                Arc::new(RedisAdapter::connect(params, self.runtime.clone())?)
            }
        };

        let mut conns = self
            .connections
            .write()
            .map_err(|_| AppError::ConnectionFailed("Connection store lock poisoned".to_string()))?;
        conns.insert(id.to_string(), adapter);

        Ok(())
    }

    /// Retrieve an active adapter by connection ID.
    pub fn get(&self, id: &str) -> Result<Arc<dyn DatabaseAdapter>, AppError> {
        let conns = self
            .connections
            .read()
            .map_err(|_| AppError::ConnectionFailed("Connection store lock poisoned".to_string()))?;
        conns
            .get(id)
            .cloned()
            .ok_or_else(|| AppError::NotFound(format!("Connection {id} not active")))
    }

    /// Disconnect and remove a connection.
    pub fn disconnect(&self, id: &str) -> Result<(), AppError> {
        let mut conns = self
            .connections
            .write()
            .map_err(|_| AppError::ConnectionFailed("Connection store lock poisoned".to_string()))?;
        if let Some(adapter) = conns.remove(id) {
            adapter.disconnect()?;
        }
        Ok(())
    }

    /// List IDs of active connections.
    pub fn active_ids(&self) -> Vec<String> {
        if let Ok(conns) = self.connections.read() {
            conns.keys().cloned().collect()
        } else {
            Vec::new()
        }
    }
}
