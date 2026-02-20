#[allow(dead_code)]
mod adapter;
mod commands;
mod db;

use adapter::ConnectionManager;
use commands::*;
use db::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let db = Database::new(app.handle())?;
            app.manage(db);

            // Create a tokio runtime for async database drivers
            let runtime = tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()
                .expect("Failed to create tokio runtime");
            let rt_handle = runtime.handle().clone();

            // Store the runtime to keep it alive
            app.manage(runtime);

            // Create the connection manager
            let conn_manager = ConnectionManager::new(rt_handle);
            app.manage(conn_manager);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_connections,
            add_connection,
            remove_connection,
            create_csv_connection,
            test_connection,
            connect_database,
            auto_connect_project_connections,
            disconnect_database,
            get_cached_schema,
            get_schema,
            get_table_metadata,
            explain_query,
            write_file,
            execute_query,
            list_projects,
            create_project,
            update_project,
            link_connection_to_project,
            unlink_connection_from_project,
            list_project_connections,
            list_explorations,
            create_exploration,
            update_exploration,
            delete_exploration,
            list_saved_queries,
            save_query,
            delete_saved_query,
            list_saved_charts,
            save_saved_chart,
            delete_saved_chart,
            list_connection_notes,
            set_connection_note,
            get_database_stats,
            import_csv,
            scan_queries,
            list_table_links,
            add_table_link,
            remove_table_link,
            list_messages,
            add_message,
            get_message_token_count,
            add_message_tokens,
            get_message_turn_count,
            increment_message_turn,
            reset_message_history,
            chat_completion,
            get_setting,
            set_setting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Arc");
}
