import { SQL_CLEANUP_PATTERNS } from './constants';

export class SQLSanitizer {
    static clean(sql: string): string {
        let cleaned = sql;

        // Remove block comments
        cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

        // Remove line comments but preserve the newline character to avoid merging lines
        cleaned = cleaned.replace(/--.*$|#.*$/gm, '');

        // Apply other cleanup patterns
        for (const { pattern, name } of SQL_CLEANUP_PATTERNS) {
            if (name === 'block-comments' || name === 'line-comments') continue;
            cleaned = cleaned.replace(pattern, '');
        }

        return cleaned.trim();
    }

    static sanitizeIdentifier(name: string): string {
        return name.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 64);
    }

    static validateIdentifier(name: string): boolean {
        // Strict whitelist: alpha-numeric and underscore only.
        // No length greater than 64.
        // Reject empty strings.
        if (!name) return false;
        return /^[a-zA-Z0-9_]{1,64}$/.test(name);
    }

    static escapeValue(value: unknown): string {
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
        return `'${String(value as string | boolean).replace(/'/g, "''")}'`;
    }

    static stripLiveKeyword(sql: string): string {
        return sql.replace(/\bLIVE\s+/gi, '');
    }
}
