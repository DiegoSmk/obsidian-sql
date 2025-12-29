// @ts-ignore
import alasql from 'alasql';
import { BLOCKED_COMMANDS } from '../utils/constants';
import { SQLSanitizer } from '../utils/SQLSanitizer';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { Logger } from '../utils/Logger';
import { DatabaseEventBus } from './DatabaseEventBus';
import { QueryResult, ResultSet } from '../types';

export class QueryExecutor {
    private static async executeWithTimeout(
        query: string,
        params?: any[],
        timeout: number = 30000,
        signal?: AbortSignal
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error('Query timeout')), timeout);

            if (signal) {
                signal.addEventListener('abort', () => {
                    clearTimeout(timeoutId);
                    reject(new Error('Query aborted'));
                });
            }

            const promise = params ? alasql.promise(query, params) : alasql.promise(query);

            promise.then((res: any) => {
                clearTimeout(timeoutId);
                resolve(res);
            }).catch((err: any) => {
                clearTimeout(timeoutId);
                reject(err);
            });
        });
    }

    static async execute(query: string, params?: any[], options: { safeMode?: boolean, signal?: AbortSignal, activeDatabase?: string, originId?: string } = {}): Promise<QueryResult> {
        const monitor = new PerformanceMonitor();
        monitor.start();

        try {
            let cleanQuery = SQLSanitizer.clean(query);

            // Split queries by semicolon for individual execution
            const statements = cleanQuery
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            // Track the active database throughout execution - WE MANAGE THIS, NOT ALASQL
            let currentDB = options.activeDatabase || 'dbo';

            // If multiple statements, execute sequentially with OUR context management
            if (statements.length > 1) {
                const results: any[] = [];

                for (let i = 0; i < statements.length; i++) {
                    let stmt = statements[i];
                    const upperStmt = stmt.toUpperCase().trim();

                    // Security checks (always ON)
                    const SECURITY_BLOCKED = [
                        /\bDROP\s+DATABASE\b/i,
                        /\bSHUTDOWN\b/i,
                        /\bALTER\s+SYSTEM\b/i
                    ];

                    for (const pattern of SECURITY_BLOCKED) {
                        if (pattern.test(stmt)) {
                            throw new Error(`Blocked SQL command: ${pattern.source.replace('\\s+', ' ')}`);
                        }
                    }

                    // Safe Mode checks
                    if (options.safeMode) {
                        const BLOCKED_IN_SAFE_MODE = [
                            /\bDROP\s+TABLE\b/i,
                            /\bTRUNCATE\s+TABLE\b/i,
                            /\bTRUNCATE\b/i,
                            /\bALTER\s+TABLE\b/i
                        ];

                        for (const pattern of BLOCKED_IN_SAFE_MODE) {
                            if (pattern.test(stmt)) {
                                throw new Error(`Safe Mode Block: Structural destruction (${pattern.source.replace('\\s+', ' ')}) is disabled.`);
                            }
                        }
                    }

                    // CRITICAL: Intercept USE statements - DO NOT pass to AlaSQL
                    const useMatch = stmt.match(/^\s*USE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/i);
                    if (useMatch) {
                        const newDB = useMatch[1];

                        // Verify database exists
                        if (!alasql.databases[newDB]) {
                            throw new Error(`Database '${newDB}' does not exist`);
                        }

                        currentDB = newDB;
                        // Return a success message instead of executing USE
                        results.push(1);
                        continue;
                    }

                    // AUTO-PREFIX table names with current database if not already prefixed
                    stmt = this.prefixTablesWithDatabase(stmt, currentDB);

                    const result = await this.executeWithTimeout(stmt, params, 30000, options.signal);
                    results.push(result);

                    // Debug: Check which tables exist after execution
                    if (upperStmt.startsWith('CREATE TABLE') || upperStmt.startsWith('DROP TABLE')) {
                        // Database state tracking removed for cleaner logs
                    }
                }

                this.notifyIfModified(statements, currentDB, options.originId);

                const normalizedData = this.normalizeResult(results);
                Logger.info(`Batch query executed (${statements.length} statements)`, {
                    executionTime: monitor.end(),
                    finalDatabase: currentDB
                });

                return {
                    success: true,
                    data: normalizedData,
                    executionTime: monitor.end(),
                    activeDatabase: currentDB
                };
            }

            // Single statement execution
            const trimmed = cleanQuery.trim().replace(/;$/, '');

            // Check for single USE statement
            const useMatch = trimmed.match(/^\s*USE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/i);
            if (useMatch) {
                const newDB = useMatch[1];
                if (!alasql.databases[newDB]) {
                    throw new Error(`Database '${newDB}' does not exist`);
                }
                // We don't actually execute USE, we just track it
                return {
                    success: true,
                    data: [{ type: 'message', data: null, message: `Database changed to '${newDB}'` }],
                    executionTime: monitor.end(),
                    activeDatabase: newDB
                };
            }

            const looksLikeSingleSelect =
                trimmed.toUpperCase().startsWith('SELECT') &&
                !trimmed.includes(';') &&
                !trimmed.toUpperCase().includes('LIMIT');

            if (looksLikeSingleSelect) {
                cleanQuery = trimmed + ' LIMIT 1000;';
            }

            // Auto-prefix if needed
            cleanQuery = this.prefixTablesWithDatabase(cleanQuery, currentDB);

            // Safe Mode Checks
            if (options.safeMode) {
                const BLOCKED_IN_SAFE_MODE = [
                    /\bDROP\s+TABLE\b/i,
                    /\bTRUNCATE\s+TABLE\b/i,
                    /\bTRUNCATE\b/i,
                    /\bALTER\s+TABLE\b/i
                ];

                for (const pattern of BLOCKED_IN_SAFE_MODE) {
                    if (pattern.test(cleanQuery)) {
                        throw new Error(`Safe Mode Block: Structural destruction (${pattern.source.replace('\\s+', ' ')}) is disabled.`);
                    }
                }
            }

            // Security Check (Always ON)
            const SECURITY_BLOCKED = [
                /\bDROP\s+DATABASE\b/i,
                /\bSHUTDOWN\b/i,
                /\bALTER\s+SYSTEM\b/i
            ];

            for (const pattern of SECURITY_BLOCKED) {
                if (pattern.test(cleanQuery)) {
                    throw new Error(`Blocked SQL command: ${pattern.source.replace('\\s+', ' ')}`);
                }
            }

            const rawResult = await this.executeWithTimeout(cleanQuery, params, 30000, options.signal);
            const normalizedData = this.normalizeResult(rawResult);

            // POST-EXECUTION: Trigger Live Updates if data was modified
            this.notifyIfModified(statements.length > 1 ? statements : [cleanQuery], currentDB, options.originId);

            Logger.info(`Query executed: ${cleanQuery.substring(0, 50)}...`, { executionTime: monitor.end() });

            return {
                success: true,
                data: normalizedData,
                executionTime: monitor.end(),
                activeDatabase: currentDB
            };
        } catch (error) {
            Logger.error("Query execution failed", error);
            return {
                success: false,
                error: error.message || String(error),
                executionTime: monitor.end()
            };
        }
    }

    /**
     * Automatically prefix table names with database name to avoid AlaSQL context bugs
     */
    private static prefixTablesWithDatabase(sql: string, database: string): string {
        if (!database || database === 'alasql') return sql;

        // CREATE TABLE table_name -> CREATE TABLE db.table_name
        sql = sql.replace(
            /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)/gi,
            (match, ifNotExists, tableName) => {
                return `CREATE TABLE ${ifNotExists || ''}${database}.${tableName}`;
            }
        );

        // INSERT INTO table_name -> INSERT INTO db.table_name
        sql = sql.replace(
            /INSERT\s+INTO\s+(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)/gi,
            (match, tableName) => {
                return `INSERT INTO ${database}.${tableName}`;
            }
        );

        // UPDATE table_name -> UPDATE db.table_name
        sql = sql.replace(
            /UPDATE\s+(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)\s+SET/gi,
            (match, tableName) => {
                return `UPDATE ${database}.${tableName} SET`;
            }
        );

        // DELETE FROM table_name -> DELETE FROM db.table_name
        sql = sql.replace(
            /DELETE\s+FROM\s+(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)/gi,
            (match, tableName) => {
                return `DELETE FROM ${database}.${tableName}`;
            }
        );

        // SELECT ... FROM table_name -> SELECT ... FROM db.table_name
        sql = sql.replace(
            /FROM\s+(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)/gi,
            (match, tableName) => {
                // Don't prefix if it's a subquery or function
                if (['SELECT', 'VALUES', '('].some(kw => tableName.toUpperCase().includes(kw))) {
                    return match;
                }
                return `FROM ${database}.${tableName}`;
            }
        );

        // JOIN table_name -> JOIN db.table_name
        sql = sql.replace(
            /JOIN\s+(?![\w]+\.)([a-zA-Z_][a-zA-Z0-9_]*)/gi,
            (match, tableName) => {
                return `JOIN ${database}.${tableName}`;
            }
        );

        return sql;
    }

    private static normalizeResult(raw: any): ResultSet[] {
        if (raw === undefined || raw === null) return [];

        // Detect batch execution
        if (Array.isArray(raw) && raw.some(r => Array.isArray(r) || typeof r === 'number')) {
            return raw.map(res => this.createResultSet(res));
        }

        return [this.createResultSet(raw)];
    }

    private static createResultSet(res: any): ResultSet {
        if (res === undefined || res === null) {
            return { type: 'message', data: null, message: 'Command executed successfully' };
        }

        if (Array.isArray(res)) {
            if (res.length === 0) {
                return { type: 'message', data: [], message: '0 rows returned', rowCount: 0 };
            }

            // Detect if it's a table (array of objects)
            if (typeof res[0] === 'object' && res[0] !== null) {
                return {
                    type: 'table',
                    data: res,
                    columns: Object.keys(res[0]),
                    rowCount: res.length
                };
            }

            return { type: 'scalar', data: res, rowCount: res.length };
        }

        if (typeof res === 'number') {
            return {
                type: 'message',
                data: res,
                message: `${res} row(s) affected`
            };
        }

        return { type: 'message', data: res, message: String(res) };
    }

    /**
     * Analyzes statements and notifies the EventBus if any data modification occurred.
     */
    private static notifyIfModified(statements: string[], database: string, originId?: string): void {
        const modifiedTables = new Set<string>();
        let isStructuralChange = false;

        const writeKeywords = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TRUNCATE'];

        for (const sql of statements) {
            const upperSql = sql.trim().toUpperCase();
            const startsWithWrite = writeKeywords.some(kw => upperSql.startsWith(kw));

            if (startsWithWrite) {
                try {
                    const ast = (alasql as any).parse(sql);

                    // Simple recursive AST traversal to find table names in write operations
                    const extractTables = (node: any) => {
                        if (!node) return;

                        // Handle INSERT / INTO
                        if (node.into && node.into.tableid) modifiedTables.add(node.into.tableid);

                        // Handle UPDATE
                        if (node.tableid) modifiedTables.add(node.tableid);

                        // Handle DELETE
                        if (node.from && Array.isArray(node.from)) {
                            node.from.forEach((f: any) => {
                                if (f.tableid) modifiedTables.add(f.tableid);
                            });
                        }

                        // Handle CREATE/DROP/ALTER
                        if (node.table && node.table.tableid) modifiedTables.add(node.table.tableid);

                        // Handle multiple statements/nodes if present
                        if (Array.isArray(node)) {
                            node.forEach(extractTables);
                        } else if (typeof node === 'object') {
                            Object.values(node).forEach(val => {
                                if (typeof val === 'object') extractTables(val);
                            });
                        }
                    };

                    extractTables(ast);

                    if (upperSql.startsWith('CREATE') || upperSql.startsWith('DROP') || upperSql.startsWith('ALTER')) {
                        isStructuralChange = true;
                    }
                } catch (e) {
                    // Fallback to simple regex if AST fails
                    const tableMatch = sql.match(/(?:INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE|DROP TABLE|ALTER TABLE)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/i);
                    if (tableMatch) {
                        const fullTableName = tableMatch[1];
                        const parts = fullTableName.split('.');
                        modifiedTables.add(parts[parts.length - 1]);
                    }
                }
            }
        }

        if (modifiedTables.size > 0 || isStructuralChange) {
            DatabaseEventBus.getInstance().emitDatabaseModified({
                database: database,
                tables: Array.from(modifiedTables),
                timestamp: Date.now(),
                originId: originId || 'unknown'
            });
        }
    }
}