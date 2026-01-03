/**
 * Handles SQL query transformations like table prefixing.
 */
export class SQLTransformer {
    private static readonly RESERVED_WORDS = ['SELECT', 'VALUES', 'RANGE', 'WITH', 'USE', 'FOR', 'EXPLODE', 'JSON', 'CSV', 'TAB', 'TSV', 'XLSX'];

    /**
     * Prefixes table names with the database name.
     */
    static prefixTablesWithDatabase(sql: string, database: string): string {
        if (!database || database === 'alasql') return sql;
        let result = sql;

        // 1. Structural commands: CREATE TABLE, INSERT INTO, UPDATE, DELETE FROM
        result = result.replace(/\b(CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+)(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)(\s*)/gi, (m: string, p: string, t: string, s: string) => {
            if (this.RESERVED_WORDS.includes(t.toUpperCase())) return m;
            return `${p}[${database}].[${t}]${s}`;
        });

        result = result.replace(/\b(INSERT\s+INTO\s+)(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)(\s*)/gi, (m: string, p: string, t: string, s: string) => {
            if (this.RESERVED_WORDS.includes(t.toUpperCase())) return m;
            return `${p}[${database}].[${t}]${s}`;
        });

        result = result.replace(/\b(UPDATE\s+)(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)\b(\s+SET)/gi, (m: string, p: string, t: string, s: string) => {
            return `${p}[${database}].[${t}]${s}`;
        });

        result = result.replace(/\b(DELETE\s+FROM\s+)(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)(\s*)/gi, (m: string, p: string, t: string, s: string) => {
            return `${p}[${database}].[${t}]${s}`;
        });

        result = result.replace(/\b((?:DROP|TRUNCATE|ALTER)\s+TABLE\s+(?:IF\s+EXISTS\s+)?)(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)(\s*)/gi, (m: string, p: string, t: string, s: string) => {
            return `${p}[${database}].[${t}]${s}`;
        });

        // 2. FROM and JOIN
        result = result.replace(/(\b(?:FROM|JOIN)\s+)(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)([\s(]*)/gi, (m: string, p: string, t: string, s: string) => {
            const upperTable = t.toUpperCase();
            if (s.includes('(') || this.RESERVED_WORDS.includes(upperTable)) return m;
            return `${p}[${database}].[${t}]${s}`;
        });

        // 3. Final safety spacing
        result = result.replace(/([0-9])([a-zA-Z]{3,})/g, '$1 $2');
        result = result.replace(/(\]\]?)([a-zA-Z0-9])/g, '$1 $2');

        return result;
    }

    static hasFragileInsertSelect(sql: string): boolean {
        const upper = sql.toUpperCase().replace(/\s+/g, ' ');
        return !!upper.match(/INSERT INTO\s+[^(]+\s*\([^)]+\)\s*SELECT/);
    }
}
