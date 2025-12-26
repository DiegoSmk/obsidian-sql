export interface MySQLSettings {
    exportFolderName: string;
    autoSave: boolean;
    batchSize: number;
    autoSaveDelay: number;
    safeMode: boolean;
    snapshotRowLimit: number;
}

export interface DatabaseSnapshot {
    version?: number;
    createdAt?: number;
    currentDB: string;
    databases: Record<string, DatabaseContent>;
}

export interface DatabaseContent {
    tables: Record<string, any[]>;
    schema: Record<string, string>;
}

export type Row = Record<string, any>;

export interface ResultSet {
    type: 'table' | 'scalar' | 'message' | 'error';
    data: Row[] | any;
    columns?: string[];
    message?: string;
    rowCount?: number;
}

export interface QueryResult {
    success: boolean;
    data?: ResultSet[];
    error?: string;
    executionTime?: number;
}

import { Plugin } from 'obsidian';

export interface IMySQLPlugin extends Plugin {
    settings: MySQLSettings;
    saveSettings(): Promise<void>;
}
