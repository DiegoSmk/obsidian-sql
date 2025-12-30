// @ts-ignore
import alasql from 'alasql';
import { BLOCKED_COMMANDS } from '../utils/constants';
import { SQLSanitizer } from '../utils/SQLSanitizer';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { Logger } from '../utils/Logger';
import { DatabaseEventBus } from './DatabaseEventBus';
import { QueryResult, ResultSet } from '../types';
import { SQLTransformer } from '../utils/SQLTransformer';


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

    static async execute(query: string, params?: any[], options: { safeMode?: boolean, signal?: AbortSignal, activeDatabase?: string, originId?: string, isLive?: boolean } = {}): Promise<QueryResult> {
        const monitor = new PerformanceMonitor();
        monitor.start();

        let currentDB = options.activeDatabase || 'dbo';

        try {
            let cleanQuery = SQLSanitizer.clean(query);
            const upperSql = cleanQuery.toUpperCase().trim();

            let warnings: string[] = [];

            // 1. Intercept FORM command (Custom DSL) - Must happen BEFORE splitting or prefixing
            if (upperSql.startsWith('FORM')) {
                return await this.handleFormCommand(cleanQuery, currentDB, monitor);
            }

            // 2. Defense in Depth: Brute-force block write operations in LIVE mode
            if (options.isLive) {
                const isSelect = upperSql.startsWith('SELECT') || upperSql.startsWith('SHOW') || upperSql.startsWith('WITH');
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
                const results: any[] = [];

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
                        if (!alasql.databases[newDB]) throw new Error(`Database '${newDB}' does not exist`);
                        currentDB = newDB;
                        results.push(1);
                        continue;
                    }

                    // Intercept FORM inside batch
                    if (upperStmt.startsWith('FORM')) {
                        const formResult = await this.handleFormCommand(stmt, currentDB, monitor);
                        results.push(formResult.data![0]); // Push the whole ResultSet
                        continue;
                    }

                    // Warning check for Fragile INSERT
                    if (SQLTransformer.hasFragileInsertSelect(stmt)) {
                        warnings.push(`⚠️ Detectado 'INSERT INTO ... (colunas) SELECT'. O AlaSQL pode falhar com erro '$01'. Se ocorrer, remova a lista de colunas, mas garanta que a ordem do SELECT corresponda exatamente às colunas da tabela.`);
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
                if (!alasql.databases[newDB]) throw new Error(`Database '${newDB}' does not exist`);
                return { success: true, data: [{ type: 'message', data: null, message: `Database changed to '${newDB}'` }], executionTime: monitor.end(), activeDatabase: newDB };
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
                warnings.push(`⚠️ Detectado 'INSERT INTO ... (colunas) SELECT'. O AlaSQL pode falhar com erro '$01'. Se ocorrer, remova e garanta a ordem exata das colunas.`);
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
            const originalMessage = error.message || String(error);
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
                return `${message}\n\n💡 Dica: '${word}' é uma palavra reservada do banco de dados. Tente usar aspas (ex: "${word.toLowerCase()}") ou mude o nome (ex: "${word.toLowerCase()}_total").`;
            }
        }
        if (message.includes("$01 is not defined")) {
            return `${message}\n\n⚠️ Erro Conhecido do AlaSQL: O uso de lista de colunas explícita em 'INSERT INTO ... SELECT' causou falha.\n\nSolução: Remova a lista de colunas (ex: 'INSERT INTO T SELECT ...') e certifique-se de que a ordem dos campos no SELECT corresponda EXATAMENTE à ordem das colunas na tabela de destino.`;
        }
        if (message.includes("Parse error")) {
            return `${message}\n\n💡 Verifique se você esqueceu algum ponto e vírgula, se há parênteses/aspas não fechadas ou erros de digitação nos nomes das tabelas.`;
        }
        return message;
    }

    private static normalizeResult(raw: any): ResultSet[] {
        if (raw === undefined || raw === null) return [];
        if (Array.isArray(raw) && raw.some(r => Array.isArray(r) || typeof r === 'number' || (typeof r === 'object' && r !== null && 'type' in r))) {
            return raw.map(res => this.createResultSet(res));
        }
        return [this.createResultSet(raw)];
    }

    private static createResultSet(res: any): ResultSet {
        if (res === undefined || res === null) return { type: 'message', data: null, message: 'Command executed successfully' };

        // If it's already a ResultSet (e.g. from FORM interception)
        if (typeof res === 'object' && res !== null && 'type' in res && 'data' in res) {
            return res as ResultSet;
        }
        if (Array.isArray(res)) {
            if (res.length === 0) return { type: 'message', data: [], message: '0 rows returned', rowCount: 0 };
            if (typeof res[0] === 'object' && res[0] !== null) {
                return { type: 'table', data: res, columns: Object.keys(res[0]), rowCount: res.length };
            }
            return { type: 'scalar', data: res, rowCount: res.length };
        }
        if (typeof res === 'number') return { type: 'message', data: res, message: `${res} row(s) affected` };
        return { type: 'message', data: res, message: String(res) };
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

        let columns: any[] = [];
        let tableObj: any = null;
        try {
            // AlaSQL internal: Try to get the rich table object first
            tableObj = (alasql.databases[database] as any)?.tables[tableName];
            if (tableObj && tableObj.columns) {
                columns = tableObj.columns;
            } else {
                // Fallback to SHOW COLUMNS if internal read fails
                columns = await alasql.promise(`SHOW COLUMNS FROM [${database}].[${tableName}]`);
            }

            if (!columns || columns.length === 0) {
                throw new Error(`Table '${tableName}' found but has no columns.`);
            }
        } catch (e) {
            throw new Error(`Table '${fullTableName}' not found. Certifique-se de que você executou o setup (01_setup.md) ou criou a tabela.`);
        }

        const customFields: Record<string, { label?: string, type?: string, options?: string[], hidden?: boolean, defaultValue?: any }> = {};
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
                const [_, fieldName, type, label, optionsStr, dflt] = fieldMatch;
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
                const isPK = col.pk === 1 || (tableObj?.pk?.columns && tableObj.pk.columns.includes(col.columnid));

                return {
                    name: col.columnid,
                    type: custom.type || this.mapSqlTypeToInput(col.dbtypeid),
                    label: custom.label || col.columnid,
                    required: col.notnull === 1,
                    defaultValue: custom.defaultValue !== undefined ? custom.defaultValue : col.dflt_value,
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
                    const ast = (alasql as any).parse(sql);
                    const extractTables = (node: any) => {
                        if (!node) return;
                        if (node.into && node.into.tableid) {
                            const tid = node.into.tableid.toLowerCase();
                            modifiedTables.add(tid.includes('.') ? tid.split('.').pop()! : tid);
                        }
                        if (node.tableid) {
                            const tid = node.tableid.toLowerCase();
                            modifiedTables.add(tid.includes('.') ? tid.split('.').pop()! : tid);
                        }
                        if (node.from && Array.isArray(node.from)) {
                            node.from.forEach((f: any) => {
                                if (f.tableid) {
                                    const tid = f.tableid.toLowerCase();
                                    modifiedTables.add(tid.includes('.') ? tid.split('.').pop()! : tid);
                                }
                            });
                        }
                        if (node.table && node.table.tableid) {
                            const tid = node.table.tableid.toLowerCase();
                            modifiedTables.add(tid.includes('.') ? tid.split('.').pop()! : tid);
                        }
                        if (Array.isArray(node)) node.forEach(extractTables);
                        else if (typeof node === 'object') Object.values(node).forEach(v => typeof v === 'object' && extractTables(v));
                    };
                    extractTables(ast);
                    if (upperSql.startsWith('CREATE') || upperSql.startsWith('DROP') || upperSql.startsWith('ALTER')) isStructuralChange = true;
                } catch (e) {
                    const writeRegex = /(?:INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE|DROP TABLE|ALTER TABLE|TRUNCATE TABLE)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi;
                    let match;
                    while ((match = writeRegex.exec(sql)) !== null) {
                        const fullTableName = match[1];
                        modifiedTables.add(fullTableName.split('.').pop()!.toLowerCase());
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