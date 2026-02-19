use std::sync::Mutex;

use rusqlite::{params, Connection};
use tauri::{AppHandle, Manager};

use crate::commands::{
    AppError, ConnectionNote, DatabaseConnection, DatabaseStats, Exploration, ExplorationMessage,
    Project, SavedQuery, TableLink,
};

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_handle: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let app_dir = app_handle.path().app_data_dir()?;
        std::fs::create_dir_all(&app_dir)?;
        let db_path = app_dir.join("arc.db");
        let connection = Connection::open(db_path)?;

        connection.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA foreign_keys=ON;",
        )?;

        connection.execute_batch(
            "CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS connections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                db_type TEXT NOT NULL,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                database_name TEXT NOT NULL,
                username TEXT NOT NULL,
                connected INTEGER NOT NULL DEFAULT 0,
                password TEXT NOT NULL DEFAULT '',
                use_ssl INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS project_connections (
                project_id TEXT NOT NULL,
                connection_id TEXT NOT NULL,
                PRIMARY KEY (project_id, connection_id),
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS explorations (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS exploration_messages (
                id TEXT PRIMARY KEY,
                exploration_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (exploration_id) REFERENCES explorations(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS saved_queries (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                sql_text TEXT NOT NULL,
                connection_id TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS connection_notes (
                connection_id TEXT PRIMARY KEY,
                note TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS table_links (
                id TEXT PRIMARY KEY,
                source_table TEXT NOT NULL,
                source_column TEXT NOT NULL,
                target_table TEXT NOT NULL,
                target_column TEXT NOT NULL,
                label TEXT NOT NULL DEFAULT '',
                connection_id TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );",
        )?;

        // Migrate: add password and use_ssl columns if missing
        connection
            .execute("ALTER TABLE connections ADD COLUMN password TEXT NOT NULL DEFAULT ''", [])
            .ok();
        connection
            .execute("ALTER TABLE connections ADD COLUMN use_ssl INTEGER NOT NULL DEFAULT 0", [])
            .ok();

        // Reset all connection statuses on startup — the ConnectionManager
        // starts empty so no adapters are actually live yet.
        connection
            .execute("UPDATE connections SET connected = 0", [])
            .ok();

        Ok(Database {
            conn: Mutex::new(connection),
        })
    }


    // --- Projects ---

    pub fn list_projects(&self) -> Result<Vec<Project>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT id, name, description, created_at FROM projects ORDER BY created_at")
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let projects: Vec<(String, String, String, String)> = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            })
            .map_err(|e| AppError::DatabaseError(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        let mut result = Vec::with_capacity(projects.len());
        for (id, name, description, created_at) in projects {
            let mut conn_stmt = conn
                .prepare("SELECT connection_id FROM project_connections WHERE project_id = ?1")
                .map_err(|e| AppError::DatabaseError(e.to_string()))?;

            let connections: Vec<String> = conn_stmt
                .query_map(params![&id], |row| row.get::<_, String>(0))
                .map_err(|e| AppError::DatabaseError(e.to_string()))?
                .filter_map(|r| r.ok())
                .collect();

            result.push(Project {
                id,
                name,
                description,
                connections,
                created_at,
            });
        }

        Ok(result)
    }

    pub fn create_project(&self, name: &str, description: &str) -> Result<Project, AppError> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let created_at = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO projects (id, name, description, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![&id, name, description, &created_at],
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok(Project {
            id,
            name: name.to_string(),
            description: description.to_string(),
            connections: vec![],
            created_at,
        })
    }

    pub fn update_project(
        &self,
        id: &str,
        name: Option<&str>,
        description: Option<&str>,
    ) -> Result<Project, AppError> {
        let conn = self.conn.lock().unwrap();

        // Check existence first
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM projects WHERE id = ?1",
                params![id],
                |row| row.get::<_, i64>(0).map(|c| c > 0),
            )
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        if !exists {
            return Err(AppError::NotFound(format!("Project {id} not found")));
        }

        if let Some(n) = name {
            conn.execute(
                "UPDATE projects SET name = ?1 WHERE id = ?2",
                params![n, id],
            )
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        }

        if let Some(d) = description {
            conn.execute(
                "UPDATE projects SET description = ?1 WHERE id = ?2",
                params![d, id],
            )
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        }

        let project = conn
            .query_row(
                "SELECT id, name, description, created_at FROM projects WHERE id = ?1",
                params![id],
                |row| {
                    Ok(Project {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        description: row.get(2)?,
                        connections: vec![],
                        created_at: row.get(3)?,
                    })
                },
            )
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let mut conn_stmt = conn
            .prepare("SELECT connection_id FROM project_connections WHERE project_id = ?1")
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let connections: Vec<String> = conn_stmt
            .query_map(params![id], |row| row.get::<_, String>(0))
            .map_err(|e| AppError::DatabaseError(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(Project {
            connections,
            ..project
        })
    }

    // --- Project-Connection linking ---

    pub fn link_connection_to_project(
        &self,
        project_id: &str,
        connection_id: &str,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO project_connections (project_id, connection_id) VALUES (?1, ?2)",
            params![project_id, connection_id],
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    pub fn unlink_connection_from_project(
        &self,
        project_id: &str,
        connection_id: &str,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM project_connections WHERE project_id = ?1 AND connection_id = ?2",
            params![project_id, connection_id],
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    pub fn list_project_connections(
        &self,
        project_id: &str,
    ) -> Result<Vec<DatabaseConnection>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT c.id, c.name, c.db_type, c.host, c.port, c.database_name, c.username, c.connected, c.password, c.use_ssl
                 FROM connections c
                 INNER JOIN project_connections pc ON c.id = pc.connection_id
                 WHERE pc.project_id = ?1
                 ORDER BY c.name",
            )
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let results = stmt
            .query_map(params![project_id], |row| {
                Ok(DatabaseConnection {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    db_type: row.get(2)?,
                    host: row.get(3)?,
                    port: row.get::<_, i32>(4)? as u16,
                    database: row.get(5)?,
                    username: row.get(6)?,
                    connected: row.get::<_, i32>(7)? != 0,
                    password: row.get(8)?,
                    use_ssl: row.get::<_, i32>(9)? != 0,
                })
            })
            .map_err(|e| AppError::DatabaseError(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(results)
    }

    // --- Connections ---

    pub fn list_connections(&self) -> Result<Vec<DatabaseConnection>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT id, name, db_type, host, port, database_name, username, connected, password, use_ssl FROM connections ORDER BY name")
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let results = stmt
            .query_map([], |row| {
                Ok(DatabaseConnection {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    db_type: row.get(2)?,
                    host: row.get(3)?,
                    port: row.get::<_, i32>(4)? as u16,
                    database: row.get(5)?,
                    username: row.get(6)?,
                    connected: row.get::<_, i32>(7)? != 0,
                    password: row.get(8)?,
                    use_ssl: row.get::<_, i32>(9)? != 0,
                })
            })
            .map_err(|e| AppError::DatabaseError(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(results)
    }

    pub fn add_connection(
        &self,
        name: &str,
        db_type: &str,
        host: &str,
        port: u16,
        database: &str,
        username: &str,
    ) -> Result<DatabaseConnection, AppError> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO connections (id, name, db_type, host, port, database_name, username, connected, password, use_ssl)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, '', 0)",
            params![&id, name, db_type, host, port as i32, database, username],
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok(DatabaseConnection {
            id,
            name: name.to_string(),
            db_type: db_type.to_string(),
            host: host.to_string(),
            port,
            database: database.to_string(),
            username: username.to_string(),
            connected: false,
            password: String::new(),
            use_ssl: false,
        })
    }

    pub fn set_connection_status(&self, id: &str, connected: bool) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE connections SET connected = ?1 WHERE id = ?2",
            params![connected as i32, id],
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    pub fn save_connection_credentials(
        &self,
        id: &str,
        password: &str,
        use_ssl: bool,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE connections SET password = ?1, use_ssl = ?2 WHERE id = ?3",
            params![password, use_ssl as i32, id],
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    pub fn remove_connection(&self, id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let affected = conn
            .execute("DELETE FROM connections WHERE id = ?1", params![id])
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        if affected == 0 {
            return Err(AppError::NotFound(format!("Connection {id} not found")));
        }
        Ok(())
    }

    // --- Explorations ---

    pub fn list_explorations(&self, project_id: &str) -> Result<Vec<Exploration>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT e.id, e.project_id, e.title, e.created_at,
                        (SELECT COUNT(*) FROM exploration_messages WHERE exploration_id = e.id) as msg_count
                 FROM explorations e
                 WHERE e.project_id = ?1
                 ORDER BY e.created_at",
            )
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let results = stmt
            .query_map(params![project_id], |row| {
                Ok(Exploration {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    created_at: row.get(3)?,
                    message_count: row.get::<_, i32>(4)? as u32,
                })
            })
            .map_err(|e| AppError::DatabaseError(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(results)
    }

    pub fn create_exploration(
        &self,
        project_id: &str,
        title: &str,
    ) -> Result<Exploration, AppError> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let created_at = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO explorations (id, project_id, title, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![&id, project_id, title, &created_at],
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok(Exploration {
            id,
            project_id: project_id.to_string(),
            title: title.to_string(),
            created_at,
            message_count: 0,
        })
    }

    pub fn update_exploration(&self, id: &str, title: &str) -> Result<Exploration, AppError> {
        let conn = self.conn.lock().unwrap();

        let affected = conn
            .execute(
                "UPDATE explorations SET title = ?1 WHERE id = ?2",
                params![title, id],
            )
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        if affected == 0 {
            return Err(AppError::NotFound(format!("Exploration {id} not found")));
        }

        let msg_count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM exploration_messages WHERE exploration_id = ?1",
                params![id],
                |row| row.get(0),
            )
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        conn.query_row(
            "SELECT id, project_id, title, created_at FROM explorations WHERE id = ?1",
            params![id],
            |row| {
                Ok(Exploration {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    created_at: row.get(3)?,
                    message_count: msg_count as u32,
                })
            },
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))
    }

    pub fn delete_exploration(&self, id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let affected = conn
            .execute("DELETE FROM explorations WHERE id = ?1", params![id])
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        if affected == 0 {
            return Err(AppError::NotFound(format!("Exploration {id} not found")));
        }
        Ok(())
    }

    // --- Messages ---

    pub fn list_messages(&self, exploration_id: &str) -> Result<Vec<ExplorationMessage>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT id, exploration_id, role, content, metadata, created_at
                 FROM exploration_messages
                 WHERE exploration_id = ?1
                 ORDER BY created_at",
            )
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let results = stmt
            .query_map(params![exploration_id], |row| {
                Ok(ExplorationMessage {
                    id: row.get(0)?,
                    exploration_id: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    metadata: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .map_err(|e| AppError::DatabaseError(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(results)
    }

    pub fn add_message(
        &self,
        exploration_id: &str,
        role: &str,
        content: &str,
        metadata: Option<&str>,
    ) -> Result<ExplorationMessage, AppError> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let created_at = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO exploration_messages (id, exploration_id, role, content, metadata, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![&id, exploration_id, role, content, metadata, &created_at],
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok(ExplorationMessage {
            id,
            exploration_id: exploration_id.to_string(),
            role: role.to_string(),
            content: content.to_string(),
            metadata: metadata.map(|s| s.to_string()),
            created_at,
        })
    }

    // --- Saved Queries ---

    pub fn list_saved_queries(&self) -> Result<Vec<SavedQuery>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT id, name, description, sql_text, connection_id, created_at
                 FROM saved_queries
                 ORDER BY created_at",
            )
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let results = stmt
            .query_map([], |row| {
                Ok(SavedQuery {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    sql: row.get(3)?,
                    connection_id: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .map_err(|e| AppError::DatabaseError(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(results)
    }

    pub fn save_query(
        &self,
        name: &str,
        description: &str,
        sql: &str,
        connection_id: &str,
    ) -> Result<SavedQuery, AppError> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let created_at = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO saved_queries (id, name, description, sql_text, connection_id, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![&id, name, description, sql, connection_id, &created_at],
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok(SavedQuery {
            id,
            name: name.to_string(),
            description: description.to_string(),
            sql: sql.to_string(),
            connection_id: connection_id.to_string(),
            created_at,
        })
    }

    pub fn delete_saved_query(&self, id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let affected = conn
            .execute("DELETE FROM saved_queries WHERE id = ?1", params![id])
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        if affected == 0 {
            return Err(AppError::NotFound(format!("Query {id} not found")));
        }
        Ok(())
    }

    // --- Connection Notes ---

    pub fn list_connection_notes(&self) -> Result<Vec<ConnectionNote>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT connection_id, note, updated_at
                 FROM connection_notes
                 ORDER BY updated_at DESC",
            )
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let results = stmt
            .query_map([], |row| {
                Ok(ConnectionNote {
                    connection_id: row.get(0)?,
                    note: row.get(1)?,
                    updated_at: row.get(2)?,
                })
            })
            .map_err(|e| AppError::DatabaseError(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(results)
    }

    pub fn set_connection_note(
        &self,
        connection_id: &str,
        note: &str,
    ) -> Result<ConnectionNote, AppError> {
        let conn = self.conn.lock().unwrap();
        let trimmed = note.trim();
        let updated_at = chrono::Utc::now().to_rfc3339();

        if trimmed.is_empty() {
            conn.execute(
                "DELETE FROM connection_notes WHERE connection_id = ?1",
                params![connection_id],
            )
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

            return Ok(ConnectionNote {
                connection_id: connection_id.to_string(),
                note: String::new(),
                updated_at,
            });
        }

        conn.execute(
            "INSERT INTO connection_notes (connection_id, note, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(connection_id) DO UPDATE SET
               note = excluded.note,
               updated_at = excluded.updated_at",
            params![connection_id, trimmed, &updated_at],
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok(ConnectionNote {
            connection_id: connection_id.to_string(),
            note: trimmed.to_string(),
            updated_at,
        })
    }

    // --- Table Links ---

    pub fn list_table_links(&self) -> Result<Vec<TableLink>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT id, source_table, source_column, target_table, target_column, label, connection_id
                 FROM table_links
                 ORDER BY source_table, source_column",
            )
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let results = stmt
            .query_map([], |row| {
                Ok(TableLink {
                    id: row.get(0)?,
                    source_table: row.get(1)?,
                    source_column: row.get(2)?,
                    target_table: row.get(3)?,
                    target_column: row.get(4)?,
                    label: row.get(5)?,
                    connection_id: row.get(6)?,
                })
            })
            .map_err(|e| AppError::DatabaseError(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(results)
    }

    pub fn add_table_link(
        &self,
        source_table: &str,
        source_column: &str,
        target_table: &str,
        target_column: &str,
        label: &str,
        connection_id: &str,
    ) -> Result<TableLink, AppError> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO table_links (id, source_table, source_column, target_table, target_column, label, connection_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![&id, source_table, source_column, target_table, target_column, label, connection_id],
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok(TableLink {
            id,
            source_table: source_table.to_string(),
            source_column: source_column.to_string(),
            target_table: target_table.to_string(),
            target_column: target_column.to_string(),
            label: label.to_string(),
            connection_id: connection_id.to_string(),
        })
    }

    pub fn remove_table_link(&self, id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let affected = conn
            .execute("DELETE FROM table_links WHERE id = ?1", params![id])
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        if affected == 0 {
            return Err(AppError::NotFound(format!("Table link {id} not found")));
        }
        Ok(())
    }

    // --- Stats ---

    pub fn get_database_stats(&self, connection_id: &str) -> Result<DatabaseStats, AppError> {
        let conn = self.conn.lock().unwrap();

        let connection = conn
            .query_row(
                "SELECT id, connected FROM connections WHERE id = ?1",
                params![connection_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, i32>(1)? != 0,
                    ))
                },
            )
            .map_err(|_| {
                AppError::NotFound(format!("Connection {connection_id} not found"))
            })?;

        // No active adapter — return metadata from stored connection info
        Ok(DatabaseStats {
            connection_id: connection.0,
            table_count: 0,
            total_row_count: 0,
            disk_usage_bytes: 0,
            connected: connection.1,
        })
    }

    // --- Settings ---

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, AppError> {
        let conn = self.conn.lock().unwrap();
        let result = conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get::<_, String>(0),
        );
        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::DatabaseError(e.to_string())),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        Ok(())
    }
}
