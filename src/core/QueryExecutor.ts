// @ts-ignore
import alasql from 'alasql';
import { BLOCKED_COMMANDS } from '../utils/constants';
import { SQLSanitizer } from '../utils/SQLSanitizer';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { Logger } from '../utils/Logger';
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

    static async execute(query: string, params?: any[], options: { safeMode?: boolean, signal?: AbortSignal, activeDatabase?: string } = {}): Promise<QueryResult> {
        const monitor = new PerformanceMonitor();
        monitor.start();

        try {
            if (options.activeDatabase && alasql.databases[options.activeDatabase]) {
                await alasql.promise(`USE ${options.activeDatabase}`);
            }

            let cleanQuery = SQLSanitizer.clean(query);

            // 2.1 Multi-query LIMIT Injection (Safe Version)
            // We only inject LIMIT if it's a clear single-statement SELECT to avoid breaking complex scripts
            const trimmed = cleanQuery.trim().replace(/;$/, '');
            const looksLikeSingleSelect =
                trimmed.toUpperCase().startsWith('SELECT') &&
                !trimmed.includes(';') &&
                !trimmed.toUpperCase().includes('LIMIT');

            if (looksLikeSingleSelect) {
                cleanQuery = trimmed + ' LIMIT 1000;';
            }

            const upperQuery = cleanQuery.toUpperCase();

            // Safe Mode Checks
            if (options.safeMode) {
                // 2.2 Robust SafeMode Syntax (detecting DROP TABLE, etc with variable whitespace)
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

            Logger.info(`Query executed: ${cleanQuery.substring(0, 50)}...`, { executionTime: monitor.end() });

            return {
                success: true,
                data: normalizedData,
                executionTime: monitor.end()
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
    private static normalizeResult(raw: any): ResultSet[] {
        if (raw === undefined || raw === null) return [];

        // Detect batch execution (AlaSQL returns [1, 1, [...] ] for multiple statements)
        if (Array.isArray(raw) && raw.some(r => Array.isArray(r))) {
            // We NO LONGER filter out numbers. We want to see how many rows were affected by each step.
            return raw.map(res => this.createResultSet(res));
        }

        return [this.createResultSet(raw)];
    }

    private static createResultSet(res: any): ResultSet {
        if (res === undefined || res === null) {
            return { type: 'message', data: null, message: 'Command executed' };
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
            // If it's a number, it's almost always a DML status (rows affected)
            // or a scalar value from a function.
            return {
                type: 'message',
                data: res,
                message: `${res} row(s) affected`
            };
        }

        return { type: 'message', data: res, message: String(res) };
    }
}
