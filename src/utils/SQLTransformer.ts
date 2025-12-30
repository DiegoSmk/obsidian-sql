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

        // Skip transformation if already prefixed or is a function call
        const tableFnCheck = (m: string, t: string, after: string) => {
            const upperT = t.toUpperCase();
            const isFunction = after.trim().startsWith('(');
            const isReserved = ['SELECT', 'VALUES', 'RANGE', 'EXPLODE', 'JSON', 'CSV', 'TAB', 'TSV', 'XLSX'].includes(upperT);

            if (isFunction || isReserved) return m;
            return m.replace(t, `[${database}].[${t}]`);
        };

        // CREATE TABLE [IF NOT EXISTS] table
        result = result.replace(/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)/gi,
            (m, i, t) => `CREATE TABLE ${i || ''}[${database}].[${t}]`);

        // INSERT INTO table
        result = result.replace(/INSERT\s+INTO\s+(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)/gi,
            (m, t) => `INSERT INTO [${database}].[${t}]`);

        // UPDATE table SET
        result = result.replace(/UPDATE\s+(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)\b(\s+SET)/gi,
            (m, t, set) => `UPDATE [${database}].[${t}]${set}`);

        // DELETE FROM table
        result = result.replace(/DELETE\s+FROM\s+(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)/gi,
            (m, t) => `DELETE FROM [${database}].[${t}]`);

        // FROM table
        result = result.replace(/FROM\s+(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)([\s]*\(?)/gi, (m, t, after) => {
            return tableFnCheck(m, t, after);
        });

        // JOIN table
        result = result.replace(/JOIN\s+(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)([\s]*\(?)/gi, (m, t, after) => {
            return tableFnCheck(m, t, after);
        });

        return result;
    }

    /**
     * Detects usage of INSERT INTO with explicit column list followed by SELECT.
     * This pattern often triggers error "$01 is not defined" in AlaSQL.
     */
    static hasFragileInsertSelect(sql: string): boolean {
        // Matches: INSERT INTO table (col1, col2) SELECT ...
        // We use a simplified regex that assumes standard syntax.
        // It looks for parenthesis between INSERT INTO and SELECT.
        const upper = sql.toUpperCase().replace(/\s+/g, ' ');
        // Check for basic structure: INSERT INTO ... (...) ... SELECT
        const match = upper.match(/INSERT INTO\s+[^(]+\s*\([^)]+\)\s*SELECT/);
        return !!match;
    }

}
