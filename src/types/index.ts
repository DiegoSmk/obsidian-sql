export type Language = 'auto' | 'en' | 'pt-BR' | 'zh' | 'es' | 'de' | 'fr' | 'ja' | 'ko';

export interface MySQLSettings {
    language: Language;
    exportFolderName: string;
    autoSave: boolean;
    batchSize: number;
    autoSaveDelay: number;
    safeMode: boolean;
    snapshotRowLimit: number;
    themeColor: string;
    useObsidianAccent: boolean;
    liveBlockAnchors: Record<string, string>;
    enableLogging: boolean;
}

export type Locale = Record<string, Record<string, string>>;

export interface AlaSQLColumn {
    columnid: string;
    dbtypeid?: string;
    primarykey?: boolean;
    auto_increment?: boolean;
    autoincrement?: boolean; // Alias often used
    identity?: boolean;
    notnull?: boolean;
    dflt_value?: unknown;
    default?: unknown;
}

export interface AlaSQLTable {
    data: unknown[];
    columns?: AlaSQLColumn[];
    pk?: { columns: string[] };
    identities?: Record<string, { value: number; step: number }>;
    defaultfns?: string; // Compiled functions string
}

export interface AlaSQLDatabase {
    tables: Record<string, AlaSQLTable>;
    lastUpdated?: number;
}

export interface DatabaseSnapshot {
    version?: number;
    createdAt?: number;
    activeDatabase: string;
    databases: Record<string, DatabaseContent>;
}

export interface DatabaseContent {
    tables: Record<string, unknown[]>;
    schema: Record<string, string>;
    lastUpdated?: number;
}

export interface DatabaseStats {
    tables: number;
    rows: number;
    sizeBytes: number;
    lastUpdated: number;
}

export type Row = Record<string, unknown>;

export interface ResultSet {
    type: 'table' | 'scalar' | 'message' | 'error' | 'form' | 'note';
    data: unknown;
    columns?: string[];
    message?: string;
    rowCount?: number;
}

export interface QueryResult {
    success: boolean;
    data?: ResultSet[];
    error?: string;
    warning?: string;
    executionTime?: number;
    activeDatabase?: string;
}

export interface IDatabaseManager {
    getDatabaseStats(dbName: string): DatabaseStats | null;
    save(): Promise<void>;
    deleteDatabase(dbName: string): Promise<void>;
    renameDatabase(oldName: string, newName: string): Promise<void>;
    createDatabase(dbName: string): Promise<void>;
    duplicateDatabase(dbName: string, newName: string): Promise<void>;
    clearDatabase(dbName: string): Promise<void>;
    exportDatabase(dbName: string): Promise<string>;
    importDatabase(sql: string): Promise<void>;
    load(): Promise<void>;
    reset(): Promise<void>;
}

export interface IQueryExecutor {
    execute(
        query: string,
        params?: unknown[],
        options?: {
            safeMode?: boolean;
            signal?: AbortSignal;
            activeDatabase?: string;
            originId?: string;
            isLive?: boolean;
        }
    ): Promise<QueryResult>;
}

export interface AlaSQLInstance {
    (sql: string, params?: unknown): unknown;
    promise: <T = unknown>(sql: string, params?: unknown) => Promise<T>;
    databases: Record<string, AlaSQLDatabase>;
    useid: string;
    parse: (sql: string) => unknown;
}

import { Plugin } from 'obsidian';

export interface IMySQLPlugin extends Plugin {
    settings: MySQLSettings;
    activeDatabase: string;
    dbManager: IDatabaseManager;
    queryExecutor: IQueryExecutor;
    saveSettings(): Promise<void>;
}
