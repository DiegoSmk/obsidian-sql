import { Locale } from '../types';

const locale: Locale = {
    "common": {
        "btn_save": "Save",
        "btn_cancel": "Cancel",
        "btn_delete": "Delete",
        "btn_confirm": "Confirm",
        "notice_success": "Success",
        "notice_error": "Error",
        "notice_deleted": "Deleted successfully",
        "notice_anchor_live": "Live block anchored to '{name}'",
        "notice_anchor_form": "Form anchored to '{name}'"
    },
    "settings": {
        "title": "SQL Notebook Settings",
        "subtitle": "Configure your local SQL environment.",
        "btn_atualizar": "Check for updates",
        "btn_importar": "Import CSV",
        "btn_novo_db": "New Database",
        "welcome_title": "Welcome to SQL Notebook!",
        "welcome_desc": "Transform your notes into a powerful relational database.",
        "search_placeholder": "Search databases or tables...",
        "info_title": "Database Insight",
        "info_tables": "Tables",
        "info_rows": "Total Rows",
        "info_size": "Memory Size",
        "info_last_sync": "Last Sync",
        "tab_general": "General",
        "tab_databases": "Databases",
        "tab_advanced": "Advanced",
        "auto_save": "Auto-save",
        "auto_save_desc": "Automatically save database state to disk.",
        "auto_save_delay": "Save Delay (ms)",
        "safe_mode": "Safe Mode",
        "safe_mode_desc": "Prevent destructive operations like DROP TABLE.",
        "enable_logging": "Enable Logging",
        "enable_logging_desc": "Detailed execution logs in console.",
        "theme_color": "Accent Color",
        "use_obsidian_accent": "Use Obsidian Accent",
        "reset_danger": "Danger Zone",
        "reset_btn": "Reset All Data",
        "reset_confirm": "This will PERMANENTLY delete all local databases. Are you sure?",
        "reset_success": "All data has been reset.",
        "language": "Language",
        "footer_by": "Designed with ❤️ by SQL Notebook Team"
    },
    "modals": {
        "title_new_db": "Create New Database",
        "title_import_csv": "Import CSV to Table",
        "label_db_name": "Database Name",
        "label_table_name": "Table Name",
        "label_select_file": "Select CSV File",
        "btn_create": "Create",
        "btn_import": "Import",
        "btn_tabelas": "Show All Tables",
        "status_executing": "Executing...",
        "status_done": "Done",
        "status_error": "Error",
        "status_note": "Note",
        "notice_db_created": "Database '{name}' created.",
        "notice_import_success": "Imported {rows} rows into '{table}'.",
        "notice_switch_success": "Switched to database '{name}'."
    },
    "workbench": {
        "empty_title": "No tables found",
        "empty_desc": "This database is empty. Create a table or import a CSV to start.",
        "btn_run": "Run SQL",
        "btn_clear": "Clear Results",
        "btn_copy": "Copy Result",
        "btn_export": "Export CSV",
        "btn_cancel": "Cancel",
        "btn_executing": "Executing...",
        "label_rows": "rows found",
        "label_time": "ms",
        "notice_copy": "Copied to clipboard",
        "notice_aborted": "Execution aborted",
        "placeholder_sql": "-- Write your SQL here...\nSELECT * FROM my_table;",
        "parameter_title": "Query Parameters",
        "parameter_desc": "This query contains parameters. Provide values below.",
        "live_pulse": "Live Data"
    },
    "renderer": {
        "rows_affected": "{count} rows affected",
        "no_results": "Query executed successfully, no results to show.",
        "blob_not_supported": "Displaying BLOB data is not supported.",
        "json_view": "View JSON",
        "table_view": "View Table"
    },
    "forms": {
        "title_new": "New Record",
        "title_edit": "Edit Record",
        "btn_insert": "Insert Record",
        "btn_update": "Update Record",
        "notice_insert_success": "New record added to '{table}'.",
        "notice_update_success": "Record updated in '{table}'."
    },
    "help": {
        "reserved_title": "Reserved Words",
        "reserved_tip": "If you use these names for tables or columns, wrap them in backticks (e.g. `order`)."
    },
    "app": {
        "app_name": "SQL notebook"
    },
    "executor": {
        "err_reserved_word": "{message}\n\n💡 Tip: '{word}' is a reserved word. Try using quotes (e.g. \"{lower}\") or change the name.",
        "err_alasql_bug_01": "{message}\n\n⚠️ Known AlaSQL Bug: Using an explicit column list in 'INSERT INTO ... SELECT' caused a failure.\n\nSolution: Remove the column list and ensure the order matches exactly.",
        "err_parse": "{message}\n\n💡 Check if you forgot a semicolon, have unclosed parentheses/quotes, or typos.",
        "warn_fragile_insert": "⚠️ 'INSERT INTO ... (columns) SELECT' detected. AlaSQL may fail with error '$01'. If it happens, remove the column list.",
        "note_db_exists": "Database '{name}' already exists.",
        "note_table_exists": "Table '{name}' already exists.",
        "msg_db_changed": "Database changed to '{name}'.",
        "msg_rows_inserted": "{count} row(s) inserted.",
        "msg_rows_updated": "{count} row(s) updated.",
        "msg_rows_deleted": "{count} row(s) deleted.",
        "msg_row_affected": "{count} row(s) affected.",
        "err_table_not_found": "Table '{name}' does not exist.",
        "err_db_not_found": "Database '{name}' does not exist.",
        "err_column_not_found": "Column '{name}' does not exist.",
        "err_blocked_command": "Security Block: SQL command '{command}' is not allowed.",
        "err_safe_mode": "Safe Mode: Command '{command}' is disabled to prevent data loss."
    }
}

export default locale;
