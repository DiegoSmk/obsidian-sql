import { MySQLSettings } from '../types';

export const DEFAULT_SETTINGS: MySQLSettings = {
    exportFolderName: 'sql-exports',
    autoSave: true,
    batchSize: 100,
    autoSaveDelay: 2000,
    safeMode: false,
    snapshotRowLimit: 10000,
    themeColor: '#9d7cd8',
    useObsidianAccent: false,
    liveBlockAnchors: {}
};

export const SQL_CLEANUP_PATTERNS = [
    { pattern: /\/\*[\s\S]*?\*\//g, name: 'block-comments' },
    { pattern: /--.*$/gm, name: 'line-comments' },
    { pattern: /(DEFAULT\s+)?(CHARACTER SET|CHARSET)\s*=?\s*[\w\d_]+/gi, name: 'charset' },
    { pattern: /(DEFAULT\s+)?COLLATE\s*=?\s*[\w\d_]+/gi, name: 'collate' },
    { pattern: /ENGINE\s*=?\s*[\w\d_]+/gi, name: 'engine' },
    { pattern: /ROW_FORMAT\s*=?\s*[\w\d_]+/gi, name: 'row-format' },
    { pattern: /AUTO_INCREMENT\s*=\s*\d+/gi, name: 'auto-increment' },
    { pattern: /LOCK\s+TABLES\s+[^;]+;/gi, name: 'lock-tables' },
    { pattern: /UNLOCK\s+TABLES\s*;?/gi, name: 'unlock-tables' },
    { pattern: /USE\s+dbo\s*;?/gi, name: 'use-dbo' },
    { pattern: /CREATE\s+DATABASE\s+(IF\s+NOT\s+EXISTS\s+)?dbo[^;]*;?/gi, name: 'create-dbo' }
];

export const BLOCKED_COMMANDS = ['DROP DATABASE', 'SHUTDOWN', 'ALTER SYSTEM'];
