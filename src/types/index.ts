export interface MySQLSettings {
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

export interface AlaSQLColumn {
    columnid: string;
    dbtypeid?: string;
    primarykey?: boolean;
    auto_increment?: boolean;
    autoincrement?: boolean;
    identity?: boolean;
}

export interface AlaSQLTable {
    data: any[];
    columns?: AlaSQLColumn[];
}

export interface DatabaseSnapshot {
    version?: number;
    createdAt?: number;
    activeDatabase: string;
    databases: Record<string, DatabaseContent>;
}

export interface DatabaseContent {
    tables: Record<string, any[]>;
    schema: Record<string, string>;
    lastUpdated?: number;
}

export interface DatabaseStats {
    tables: number;
    rows: number;
    sizeBytes: number;
    lastUpdated: number;
}

export type Row = Record<string, any>;

export interface ResultSet {
    type: 'table' | 'scalar' | 'message' | 'error' | 'form';
    data: Row[] | any;
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

import { Plugin } from 'obsidian';

export interface IMySQLPlugin extends Plugin {
    settings: MySQLSettings;
    activeDatabase: string;
    saveSettings(): Promise<void>;
}
