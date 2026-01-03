import { SQL_CLEANUP_PATTERNS } from './constants';

export class SQLSanitizer {
    static clean(sql: string): string {
        let cleaned = sql;

        // 1. Remove block comments but keep the space to avoid merging
        cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, ' ');

        // 2. Remove line comments but PRESERVE THE NEWLINE
        // We replacement from -- or # until the end of the line.
        // We must be careful not to consume the newline itself if we want to preserve it.
        cleaned = cleaned.replace(/(--|#).*?(\r?\n|$)/gm, (match, prefix, after) => {
            return ' ' + after;
        });

        // 3. Ensure newlines are treated as separators by adding a space before them.
        // This prevents issues where newlines might be stripped or ignored by parsers/transformers,
        // causing words to merge (e.g. "table\nSELECT" -> "tableSELECT").
        // We use a lookbehind to avoid adding space if one already exists.
        cleaned = cleaned.replace(/(?<!\s)(\r?\n)/g, ' $1');

        // 4. Apply other cleanup patterns
        for (const { pattern, name } of SQL_CLEANUP_PATTERNS) {
            if (name === 'block-comments' || name === 'line-comments') continue;
            // Always replace with a space to avoid merging words
            cleaned = cleaned.replace(pattern, ' ');
        }

        return cleaned.trim();
    }

    static sanitizeIdentifier(name: string): string {
        return name.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 64);
    }

    static validateIdentifier(name: string): boolean {
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
        // Only strip LIVE if it's followed by whitespace. Replace with a space to preserve separation.
        return sql.replace(/\bLIVE\s+/gi, ' ');
    }
}
