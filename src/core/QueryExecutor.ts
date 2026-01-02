// @ts-ignore
import alasql from 'alasql';
import { SQLSanitizer } from '../utils/SQLSanitizer';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { Logger } from '../utils/Logger';
import { DatabaseEventBus } from './DatabaseEventBus';
import { QueryResult, ResultSet, AlaSQLInstance, AlaSQLTable, AlaSQLColumn } from '../types';
import { SQLTransformer } from '../utils/SQLTransformer';
import { t } from '../utils/i18n';



export class QueryExecutor {
    private static async executeWithTimeout(
        query: string,
        params?: unknown[],
        timeout: number = 30000,
        signal?: AbortSignal
    ): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error('Query timeout')), timeout);

            if (signal) {
                signal.addEventListener('abort', () => {
                    clearTimeout(timeoutId);
                    reject(new Error('Query aborted'));
                });
            }

            const promise = params ? (alasql as unknown as AlaSQLInstance).promise(query, params) : (alasql as unknown as AlaSQLInstance).promise(query);

            promise.then((res: unknown) => {
                clearTimeout(timeoutId);
                resolve(res);
            }).catch((err: unknown) => {
                clearTimeout(timeoutId);
                let errorMessage = '';
                if (err instanceof Error) {
                    errorMessage = err.message;
                } else if (typeof err === 'object' && err !== null) {
                    errorMessage = JSON.stringify(err);
                } else {
                    errorMessage = String(err as string | number | boolean);
                }
                reject(new Error(errorMessage));
            });
        });
    }

    static async execute(query: string, params?: unknown[], options: { safeMode?: boolean, signal?: AbortSignal, activeDatabase?: string, originId?: string, isLive?: boolean } = {}): Promise<QueryResult> {
        const monitor = new PerformanceMonitor();
        monitor.start();

        let currentDB = options.activeDatabase || 'dbo';

        try {
            let cleanQuery = SQLSanitizer.clean(query);
            if (options.isLive) {
                cleanQuery = SQLSanitizer.stripLiveKeyword(cleanQuery);
            }
            const upperSql = cleanQuery.toUpperCase().trim();

            let warnings: string[] = [];

            // 1. Intercept FORM command (Custom DSL) - Must happen BEFORE splitting or prefixing
            if (upperSql.startsWith('FORM')) {
                return await this.handleFormCommand(cleanQuery, currentDB, monitor);
            }

            // 2. Defense in Depth: Brute-force block write operations in LIVE mode
            if (options.isLive) {
                const isSelect = upperSql.startsWith('SELECT') || upperSql.startsWith('SHOW') || upperSql.startsWith('WITH') || upperSql.startsWith('USE');
                if (!isSelect || upperSql.includes('INSERT ') || upperSql.includes('UPDATE ') || upperSql.includes('DELETE ') || upperSql.includes('DROP ')) {
                    throw new Error("Security Block: LIVE blocks are strictly read-only and must be SELECT/SHOW queries.");
                }
            }

            // Split queries by semicolon for individual execution
            const statements = cleanQuery
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            // If multiple statements, execute sequentially with OUR context management
            if (statements.length > 1) {
                const results: unknown[] = [];

                for (let i = 0; i < statements.length; i++) {
                    let stmt = statements[i];
                    const upperStmt = stmt.toUpperCase().trim();

                    // Security checks (always ON)
                    const SECURITY_BLOCKED = [/\bDROP\s+DATABASE\b/i, /\bSHUTDOWN\b/i, /\bALTER\s+SYSTEM\b/i];
                    for (const pattern of SECURITY_BLOCKED) {
                        if (pattern.test(stmt)) {
                            throw new Error(`Blocked SQL command: ${pattern.source.replace('\\s+', ' ')}`);
                        }
                    }

                    // Safe Mode checks
                    if (options.safeMode) {
                        const BLOCKED_IN_SAFE_MODE = [/\bDROP\s+TABLE\b/i, /\bTRUNCATE\s+TABLE\b/i, /\bTRUNCATE\b/i, /\bALTER\s+TABLE\b/i];
                        for (const pattern of BLOCKED_IN_SAFE_MODE) {
                            if (pattern.test(stmt)) {
                                throw new Error(`Safe Mode Block: Structural destruction (${pattern.source.replace('\\s+', ' ')}) is disabled.`);
                            }
                        }
                    }

                    // Intercept USE statements
                    const useMatch = stmt.match(/^\s*USE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/i);
                    if (useMatch) {
                        const newDB = useMatch[1];
                        if (!(alasql as unknown as AlaSQLInstance).databases[newDB]) throw new Error(`Database '${newDB}' does not exist`);
                        currentDB = newDB;
                        results.push(1);
                        continue;
                    }

                    // Intercept FORM inside batch
                    if (upperStmt.startsWith('FORM')) {
                        const formResult = await this.handleFormCommand(stmt, currentDB, monitor);
                        results.push(formResult.data[0]); // Push the whole ResultSet
                        continue;
                    }

                    // Warning check for Fragile INSERT
                    if (SQLTransformer.hasFragileInsertSelect(stmt)) {
                        warnings.push(t('executor.warn_fragile_insert'));
                    }

                    stmt = SQLTransformer.prefixTablesWithDatabase(stmt, currentDB);
                    const result = await this.executeWithTimeout(stmt, params, 30000, options.signal);
                    results.push(result);
                }

                this.notifyIfModified(statements, currentDB, options.originId);
                const normalizedData = this.normalizeResult(results);
                Logger.info(`Batch query executed (${statements.length} statements)`, { executionTime: monitor.end(), finalDatabase: currentDB });
                const finalWarning = warnings.length > 0 ? warnings.join('\n') : undefined;
                return { success: true, data: normalizedData, executionTime: monitor.end(), activeDatabase: currentDB, warning: finalWarning };
            }

            // Single statement execution
            const trimmed = cleanQuery.trim().replace(/;$/, '');
            const trimmedUpper = trimmed.toUpperCase();

            // Intercept USE
            const useMatch = trimmed.match(/^\s*USE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/i);
            if (useMatch) {
                const newDB = useMatch[1];
                if (!(alasql as unknown as AlaSQLInstance).databases[newDB]) throw new Error(`Database '${newDB}' does not exist`);
                return { success: true, data: [{ type: 'message', data: null, message: t('modals.notice_switch_success', { name: newDB }) }], executionTime: monitor.end(), activeDatabase: newDB };
            }

            // Security Check (Always ON)
            const SECURITY_BLOCKED = [/\bDROP\s+DATABASE\b/i, /\bSHUTDOWN\b/i, /\bALTER\s+SYSTEM\b/i];
            for (const pattern of SECURITY_BLOCKED) {
                if (pattern.test(trimmed)) throw new Error(`Blocked SQL command: ${pattern.source.replace('\\s+', ' ')}`);
            }

            // Safe Mode
            if (options.safeMode) {
                const BLOCKED_IN_SAFE_MODE = [/\bDROP\s+TABLE\b/i, /\bTRUNCATE\s+TABLE\b/i, /\bTRUNCATE\b/i, /\bALTER\s+TABLE\b/i];
                for (const pattern of BLOCKED_IN_SAFE_MODE) {
                    if (pattern.test(trimmed)) throw new Error(`Safe Mode Block: Structural destruction (${pattern.source.replace('\\s+', ' ')}) is disabled.`);
                }
            }

            // Warning check for Fragile INSERT
            if (SQLTransformer.hasFragileInsertSelect(trimmed)) {
                warnings.push(t('executor.warn_fragile_insert'));
            }

            const looksLikeSingleSelect = trimmedUpper.startsWith('SELECT') && !trimmed.includes(';') && !trimmedUpper.includes('LIMIT');
            let finalQuery = looksLikeSingleSelect ? trimmed + ' LIMIT 1000;' : trimmed;
            finalQuery = SQLTransformer.prefixTablesWithDatabase(finalQuery, currentDB);

            const rawResult = await this.executeWithTimeout(finalQuery, params, 30000, options.signal);
            const normalizedData = this.normalizeResult(rawResult);

            this.notifyIfModified([finalQuery], currentDB, options.originId);
            Logger.info(`Query executed: ${finalQuery.substring(0, 50)}...`, { executionTime: monitor.end() });

            return { success: true, data: normalizedData, executionTime: monitor.end(), activeDatabase: currentDB, warning: warnings.length > 0 ? warnings.join('\n') : undefined };

        } catch (error) {
            Logger.error("Query execution failed", error);
            const originalMessage = (error as Error).message || String(error);
            const beautifiedMessage = this.beautifyError(originalMessage);
            return { success: false, error: beautifiedMessage, executionTime: monitor.end() };
        }
    }

    private static beautifyError(message: string): string {
        const match = message.match(/got '([^']+)'/i);
        if (match) {
            const word = match[1].toUpperCase();
            const reserved = ['TOTAL', 'VALUE', 'SUM', 'COUNT', 'MIN', 'MAX', 'AVG', 'KEY', 'ORDER', 'GROUP', 'DATE', 'DESC', 'ASC'];
            if (reserved.includes(word)) {
                return t('executor.err_reserved_word', { message, word, lower: word.toLowerCase() });
            }
        }
        if (message.includes("$01 is not defined")) {
            return t('executor.err_alasql_bug_01', { message });
        }
        if (message.includes("Parse error")) {
            return t('executor.err_parse', { message });
        }
        return message;
    }

    private static normalizeResult(raw: unknown): ResultSet[] {
        if (raw === undefined || raw === null) return [];
        if (Array.isArray(raw) && raw.some(r => Array.isArray(r) || typeof r === 'number' || (typeof r === 'object' && r !== null && 'type' in r))) {
            return raw.map(res => this.createResultSet(res));
        }
        return [this.createResultSet(raw)];
    }

    private static createResultSet(res: unknown): ResultSet {
        if (res === undefined || res === null) return { type: 'message', data: null, message: t('modals.status_done') };

        // If it's already a ResultSet (e.g. from FORM interception)
        if (typeof res === 'object' && res !== null && 'type' in res && 'data' in res) {
            return res as ResultSet;
        }
        if (Array.isArray(res)) {
            if (res.length === 0) return { type: 'message', data: [], message: '0 rows returned', rowCount: 0 };
            if (typeof res[0] === 'object' && res[0] !== null) {
                const firstRow = res[0] as Record<string, unknown>;
                return { type: 'table', data: res, columns: Object.keys(firstRow), rowCount: res.length };
            }
            return { type: 'scalar', data: res, rowCount: res.length };
        }
        if (typeof res === 'number') return { type: 'message', data: res, message: t('renderer.rows_affected', { count: String(res) }) };
        let message = '';
        if (typeof res === 'object' && res !== null) {
            message = JSON.stringify(res);
        } else {
            message = String(res as string | number | boolean);
        }
        return { type: 'message', data: res, message };
    }

    private static async handleFormCommand(query: string, database: string, monitor: PerformanceMonitor): Promise<QueryResult> {
        const lines = query.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const firstLine = lines[0];
        const tableMatch = firstLine.match(/^FORM\s+([a-zA-Z_][a-zA-Z0-9_.]*)/i);
        if (!tableMatch) throw new Error("Invalid FORM syntax. Expected: FORM table_name");

        let fullTableName = tableMatch[1];
        if (!fullTableName.includes('.')) fullTableName = `${database}.${fullTableName}`;

        const [dbPart, tablePart] = fullTableName.split('.');
        if (!SQLSanitizer.validateIdentifier(dbPart) || !SQLSanitizer.validateIdentifier(tablePart)) {
            throw new Error(`Security Error: Invalid table or database name identifier.`);
        }

        const tableName = tablePart;

        let columns: AlaSQLColumn[] = [];
        let tableObj: AlaSQLTable | null = null;
        try {
            // AlaSQL internal: Try to get the rich table object first
            tableObj = (alasql as unknown as AlaSQLInstance).databases[database]?.tables[tableName];
            if (tableObj && tableObj.columns) {
                columns = tableObj.columns;
            } else {
                // Fallback to SHOW COLUMNS if internal read fails
                columns = await (alasql as unknown as AlaSQLInstance).promise<AlaSQLColumn[]>(`SHOW COLUMNS FROM [${database}].[${tableName}]`);
            }

            if (!columns || columns.length === 0) {
                throw new Error(`Table '${tableName}' found but has no columns.`);
            }
        } catch {
            throw new Error(`Table '${fullTableName}' not found.`);
        }

        const customFields: Record<string, { label?: string, type?: string, options?: string[], hidden?: boolean, defaultValue?: unknown }> = {};
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.toUpperCase().includes(' HIDDEN')) {
                const fieldName = line.split(/\s+/)[0].toLowerCase();
                customFields[fieldName] = { ...customFields[fieldName], hidden: true };
                continue;
            }
            // Match: field_name TYPE "Label" (option1, option2) DEFAULT "val"
            const fieldMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+([a-zA-Z]+)?\s*(?:"([^"]+)")?\s*(?:\(([^)]+)\))?\s*(?:DEFAULT\s+([^ ]+))?/i);
            if (fieldMatch) {
                const [, fieldName, type, label, optionsStr, dflt] = fieldMatch;
                const lowerName = fieldName.toLowerCase();
                customFields[lowerName] = {
                    ...customFields[lowerName],
                    type: type?.toUpperCase(),
                    label,
                    hidden: type?.toUpperCase() === 'HIDDEN',
                    options: optionsStr ? optionsStr.split(',').map(o => o.trim().replace(/^'|'$/g, '')) : undefined,
                    defaultValue: dflt?.replace(/^'|'$/g, '')
                };
            }
        }

        const formData = {
            tableName: fullTableName,
            baseTableName: tableName,
            fields: columns.map(col => {
                const name = col.columnid.toLowerCase();
                const custom = customFields[name] || {};

                // Detect auto-increment or identity fields
                const isAuto = !!(col.autoincrement || col.auto_increment || col.identity);
                const pkInfo = (tableObj as unknown as Record<string, unknown>)?.pk as { columns: string[] } | undefined;
                const isPK = col.primarykey === true || (pkInfo?.columns && pkInfo.columns.includes(col.columnid));

                return {
                    name: col.columnid,
                    type: custom.type || this.mapSqlTypeToInput(col.dbtypeid),
                    label: custom.label || col.columnid,
                    required: (col as unknown as Record<string, unknown>).notnull === 1,
                    defaultValue: custom.defaultValue !== undefined ? custom.defaultValue : (col as unknown as Record<string, unknown>).dflt_value,
                    options: custom.options,
                    isPrimaryKey: isPK,
                    isAutoIncrement: isAuto || custom.hidden || (name === 'id' && isPK)
                };
            })
        };

        return {
            success: true,
            data: [{ type: 'form', data: formData, message: `Form for ${fullTableName}` }],
            executionTime: monitor.end(),
            activeDatabase: database
        };
    }

    private static mapSqlTypeToInput(sqlType?: string): string {
        if (!sqlType) return 'TEXT';
        const type = sqlType.toUpperCase();
        if (['INT', 'INTEGER', 'NUMBER', 'DECIMAL', 'FLOAT', 'DOUBLE'].some(t => type.includes(t))) return 'NUMBER';
        if (type.includes('DATE') || type.includes('TIME')) return 'DATE';
        if (type.includes('BOOLEAN') || type.includes('BOOL')) return 'CHECKBOX';
        return 'TEXT';
    }

    private static notifyIfModified(statements: string[], database: string, originId?: string): void {
        const modifiedTables = new Set<string>();
        let isStructuralChange = false;
        const writeKeywords = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TRUNCATE'];

        for (const sql of statements) {
            const upperSql = sql.trim().toUpperCase();
            if (writeKeywords.some(kw => upperSql.startsWith(kw))) {
                try {
                    const ast = (alasql as unknown as AlaSQLInstance).parse(sql);
                    const extractTables = (node: unknown) => {
                        if (!node || typeof node !== 'object') return;
                        const n = node as Record<string, unknown>;
                        if (n.into && (n.into as Record<string, string>).tableid) {
                            const tid = (n.into as Record<string, string>).tableid.toLowerCase();
                            modifiedTables.add(tid.includes('.') ? (tid.split('.').pop() || '') : tid);
                        }
                        if (n.tableid) {
                            const tid = (n as Record<string, string>).tableid.toLowerCase();
                            modifiedTables.add(tid.includes('.') ? (tid.split('.').pop() || '') : tid);
                        }
                        if (n.from && Array.isArray(n.from)) {
                            (n.from as unknown[]).forEach((f: unknown) => {
                                if (f && typeof f === 'object' && (f as Record<string, string>).tableid) {
                                    const tid = (f as Record<string, string>).tableid.toLowerCase();
                                    modifiedTables.add(tid.includes('.') ? (tid.split('.').pop() || '') : tid);
                                }
                            });
                        }
                        if (n.table && (n.table as Record<string, string>).tableid) {
                            const tid = (n.table as Record<string, string>).tableid.toLowerCase();
                            modifiedTables.add(tid.includes('.') ? (tid.split('.').pop() || '') : tid);
                        }
                        if (Array.isArray(n)) (n as unknown[]).forEach(extractTables);
                        else Object.values(n).forEach(v => typeof v === 'object' && extractTables(v));
                    };
                    extractTables(ast);
                    if (upperSql.startsWith('CREATE') || upperSql.startsWith('DROP') || upperSql.startsWith('ALTER')) isStructuralChange = true;
                } catch {
                    const writeRegex = /(?:INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE|DROP TABLE|ALTER TABLE|TRUNCATE TABLE)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi;
                    let match;
                    while ((match = writeRegex.exec(sql)) !== null) {
                        const fullTableName = match[1];
                        const lastPart = fullTableName.split('.').pop();
                        if (lastPart) modifiedTables.add(lastPart.toLowerCase());
                    }
                }
            }
        }

        if (modifiedTables.size > 0 || isStructuralChange) {
            const tables = Array.from(modifiedTables).map(t => t.toLowerCase());
            DatabaseEventBus.getInstance().emitDatabaseModified({ database, tables, timestamp: Date.now(), originId: originId || 'unknown' });
        }
    }
}