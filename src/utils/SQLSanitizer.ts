import { SQL_CLEANUP_PATTERNS } from './constants';

export class SQLSanitizer {
    static clean(sql: string): string {
        let cleaned = sql;

        for (const { pattern } of SQL_CLEANUP_PATTERNS) {
            cleaned = cleaned.replace(pattern, '');
        }

        return cleaned.replace(/^\s*[\r\n]/gm, '').trim();
    }

    static sanitizeIdentifier(name: string): string {
        return name.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 64);
    }

    static escapeValue(value: any): string {
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'number') return String(value);
        return `'${String(value).replace(/'/g, "''")}'`;
    }
}
