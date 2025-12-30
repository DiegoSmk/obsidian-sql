/**
 * Handles SQL query transformations like table prefixing.
 */
export class SQLTransformer {
    /**
     * Prefixes table names with the database name unless it's a known function or already prefixed.
     */
    static prefixTablesWithDatabase(sql: string, database: string): string {
        if (!database || database === 'alasql') return sql;
        let result = sql;

        // Skip prefixing if followed by ( indicating a function call (e.g., RANGE())
        // Used primarily in FROM and JOIN
        const notAFunction = /(?![\s]*\()/.source;

        // CREATE TABLE [IF NOT EXISTS] table
        result = result.replace(new RegExp(/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(?!\w+\.)([a-zA-Z_][a-zA-Z0-9_]*)\b/.source, 'gi'),
            (m, i, t) => `CREATE TABLE ${i || ''}${database}.${t}`);

        // INSERT INTO table
        result = result.replace(new RegExp(/INSERT\s+INTO\s+(?!\w+\.)([a-zA-Z_][a-zA-Z0-9_]*)\b/.source, 'gi'),
            (m, t) => `INSERT INTO ${database}.${t}`);

        // UPDATE table SET
        result = result.replace(new RegExp(/UPDATE\s+(?!\w+\.)([a-zA-Z_][a-zA-Z0-9_]*)\b/.source + /\s+SET/.source, 'gi'),
            (m, t) => `UPDATE ${database}.${t} SET`);

        // DELETE FROM table
        result = result.replace(new RegExp(/DELETE\s+FROM\s+(?!\w+\.)([a-zA-Z_][a-zA-Z0-9_]*)\b/.source, 'gi'),
            (m, t) => `DELETE FROM ${database}.${t}`);

        // FROM table (Most critical for skipping functions like RANGE)
        result = result.replace(new RegExp(/FROM\s+(?!\w+\.)([a-zA-Z_][a-zA-Z0-9_]*)\b/.source + notAFunction, 'gi'), (m, t) => {
            const upperT = t.toUpperCase();
            if (['SELECT', 'VALUES', '(', 'RANGE', 'EXPLODE', 'JSON', 'CSV', 'TAB', 'TSV', 'XLSX'].includes(upperT)) return m;
            return `FROM ${database}.${t}`;
        });

        // JOIN table
        result = result.replace(new RegExp(/JOIN\s+(?!\w+\.)([a-zA-Z_][a-zA-Z0-9_]*)\b/.source + notAFunction, 'gi'), (m, t) => {
            const upperT = t.toUpperCase();
            if (['SELECT', 'VALUES', '(', 'RANGE', 'EXPLODE', 'JSON', 'CSV', 'TAB', 'TSV', 'XLSX'].includes(upperT)) return m;
            return `JOIN ${database}.${t}`;
        });

        return result;
    }
}
