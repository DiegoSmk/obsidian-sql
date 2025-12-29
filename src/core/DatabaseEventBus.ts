import { Events } from 'obsidian';

/**
 * Interface representing a database change event.
 */
export interface DatabaseChangeEvent {
    database: string;
    tables: string[];
    timestamp: number;
    originId: string;
}

/**
 * Singleton DatabaseEventBus that manages database change notifications.
 * Uses Obsidian's built-in Events system for lightweight communication.
 */
export class DatabaseEventBus extends Events {
    private static instance: DatabaseEventBus;

    public static DATABASE_MODIFIED = 'database-modified';

    private constructor() {
        super();
    }

    /**
     * Gets the singleton instance of the DatabaseEventBus.
     */
    public static getInstance(): DatabaseEventBus {
        if (!DatabaseEventBus.instance) {
            DatabaseEventBus.instance = new DatabaseEventBus();
        }
        return DatabaseEventBus.instance;
    }

    /**
     * Emits a database modified event.
     * @param event The event data.
     */
    public emitDatabaseModified(event: DatabaseChangeEvent): void {
        // Normalize table names to lowercase for consistent matching
        event.tables = event.tables.map(t => t.toLowerCase());
        this.trigger(DatabaseEventBus.DATABASE_MODIFIED, event);
    }

    /**
     * Registers a listener for database modified events.
     * @param callback The function to call when a change occurs.
     */
    public onDatabaseModified(callback: (event: DatabaseChangeEvent) => void): void {
        this.on(DatabaseEventBus.DATABASE_MODIFIED, callback);
    }
}
