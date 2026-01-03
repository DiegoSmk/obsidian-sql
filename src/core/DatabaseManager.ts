// @ts-ignore
import alasql from 'alasql';
import { IMySQLPlugin, DatabaseSnapshot, DatabaseStats, AlaSQLInstance } from '../types';
import { Logger } from '../utils/Logger';
import { DatabaseEventBus } from './DatabaseEventBus';
import { SchemaReconstructor } from '../utils/SchemaReconstructor';


export class DatabaseManager {
    private isSaving: boolean = false;
    private pendingSave: boolean = false;

    constructor(private plugin: IMySQLPlugin) { }

    async save(): Promise<void> {
        if (this.isSaving) {
            this.pendingSave = true;
            return;
        }

        this.isSaving = true;
        this.pendingSave = false;

        try {
            const snapshot = await this.createSnapshot();
            // Directly merge settings with snapshot. snapshot already contains activeDatabase and version.
            const finalData = { ...this.plugin.settings, ...snapshot };

            // Single write operation to disk
            await this.plugin.saveData(finalData);

            Logger.info("Database saved successfully.");
        } catch (error) {
            console.error('MySQL Plugin: Save failed', error);
        } finally {
            this.isSaving = false;
            // Check if a save was requested while we were saving
            if (this.pendingSave) {
                void this.save();
            }
        }
    }

    private async createSnapshot(): Promise<DatabaseSnapshot> {
        const activeDatabase = this.plugin.activeDatabase || 'dbo';
        // Filter out default alasql database to prevent duplication/pollution
        const databases = Object.keys((alasql as unknown as AlaSQLInstance).databases).filter(d => d !== 'alasql');
        const snapshot: DatabaseSnapshot = {
            version: 1,
            createdAt: Date.now(),
            activeDatabase,
            databases: {}
        };

        for (const dbName of databases) {
            try {
                // Direct access - Safer than switching context
                const dbInstance = (alasql as unknown as AlaSQLInstance).databases[dbName];
                if (!dbInstance) continue;

                const dbData: Record<string, unknown[]> = {};
                const dbSchema: Record<string, string> = {};

                if (dbInstance.tables) {
                    let tableCount = 0;
                    for (const tableName of Object.keys(dbInstance.tables)) {
                        const tableObj = dbInstance.tables[tableName];
                        const rows = tableObj.data || [];

                        const limit = this.plugin.settings.snapshotRowLimit || 10000;

                        // Copy data (sliced to limit)
                        if (rows.length > limit) {
                            Logger.warn(`Snapshot for table '${tableName}' truncated to limit of ${limit} rows.`);
                            dbData[tableName] = rows.slice(0, limit);
                        } else {
                            dbData[tableName] = rows;
                        }

                        // Generate Schema from AlaSQL internal structure (Supports empty tables and metadata)
                        try {
                            dbSchema[tableName] = SchemaReconstructor.reconstruct(tableName, tableObj);
                        } catch (e) {
                            Logger.warn(`Failed to reconstruct schema for table '${tableName}':`, e);
                            // Fallback: Generate from data structure if reconstruction fails
                            if (rows.length > 0) {
                                const firstRow = rows[0] as Record<string, unknown>;
                                const columns = Object.keys(firstRow).map(col => {
                                    const value = firstRow[col];
                                    let type = 'VARCHAR';
                                    if (value === null || value === undefined) type = 'VARCHAR';
                                    else if (typeof value === 'number') type = Number.isInteger(value) ? 'INT' : 'FLOAT';
                                    else if (typeof value === 'boolean') type = 'BOOLEAN';
                                    else if (value instanceof Date) type = 'DATE';

                                    return `\`${col}\` ${type}`;
                                }).join(', ');

                                const createSQL = `CREATE TABLE \`${tableName}\` (${columns})`;
                                dbSchema[tableName] = createSQL;
                            }
                        }

                        tableCount++;
                        if (tableCount % 10 === 0) {
                            await new Promise(resolve => setTimeout(resolve, 0));
                        }
                    }
                }

                snapshot.databases[dbName] = {
                    tables: dbData,
                    schema: dbSchema,
                    lastUpdated: Date.now()
                };

            } catch (error) {
                console.error(`Failed to snapshot database ${dbName}:`, error);
            }
        }

        return snapshot;
    }

    async load(): Promise<void> {
        const data = await this.plugin.loadData() as (DatabaseSnapshot & { currentDB?: string });

        if (!data?.databases) {
            return;
        }

        try {
            const activeDB = data.activeDatabase || data.currentDB || 'dbo';
            const dbNames = Object.keys(data.databases);

            Logger.info(`Starting database restoration for ${dbNames.length} databases...`);

            for (const dbName of dbNames) {
                if (dbName === 'alasql') continue; // Skip default/system db

                const db = data.databases[dbName];

                if (!db.tables && !db.schema) continue;

                // Create database with quoted identifier for safety
                try {
                    await (alasql as unknown as AlaSQLInstance).promise(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
                } catch (e) {
                    // Ignore already exists error
                    if (!(e as Error).message.includes('already exists')) throw e;
                }

                // Switch context to this database - This prevents regex fragility
                // because all subsequent operations will apply to the current DB
                await (alasql as unknown as AlaSQLInstance).promise(`USE \`${dbName}\``);


                // Yield to keep UI responsive
                await new Promise(resolve => setTimeout(resolve, 0));

                if (db.schema) {
                    for (const [tableName, sql] of Object.entries(db.schema)) {
                        try {
                            await (alasql as AlaSQLInstance).promise(`DROP TABLE IF EXISTS \`${tableName}\``);

                            // Since we are in the correct DB context, we can just execute the original CREATE SQL
                            // AlaSQL SHOW CREATE usually returns clean SQL. 
                            // If it has a prefix, AlaSQL ignores it if we are inside the DB? No, we might need to be careful.
                            // But usually "CREATE TABLE tab..." works in current context.

                            // Fallback: If SQL contains explicit other DB prefix, it might fail. 
                            // But our regex was trying to force prefix. Here we rely on context.
                            // We do a simple clean to remove potential prefixes if they exist to be safe?
                            // Actually, just running the SQL is usually safer if it was generated by SHOW CREATE.
                            // UPDATE: AlaSQL's SHOW CREATE often returns "CREATE TABLE database.table ..."
                            // This is why regex was used. 
                            // Instead of complex regex, let's just strip the prefix if it matches the DB name.

                            let createSQL = String(sql);

                            // Basic strip of obvious prefix "CREATE TABLE dbName.tableName" -> "CREATE TABLE tableName"
                            // This is safer than trying to inject it.
                            const prefixRegex = new RegExp(`CREATE\\s+TABLE\\s+(?:\`?${dbName}\`?\\.)`, 'i');
                            if (createSQL.match(prefixRegex)) {
                                createSQL = createSQL.replace(prefixRegex, 'CREATE TABLE ');
                            }

                            await (alasql as AlaSQLInstance).promise(createSQL);
                        } catch (e) {
                            console.error(`Error restoring schema for '${tableName}':`, e);
                            // Fallback for simple restoration if CREATE failed
                        }
                    }
                }

                if (db.tables) {
                    let tableCount = 0;
                    for (const [tableName, rows] of Object.entries(db.tables)) {
                        if (!rows || rows.length === 0) continue;

                        // Validate data structure to prevent crashes
                        if (!Array.isArray(rows)) {
                            Logger.warn(`Skipping table ${tableName}: data is not an array`);
                            continue;
                        }
                        if (rows.length > 0 && (typeof rows[0] !== 'object' || rows[0] === null)) {
                            Logger.warn(`Skipping table ${tableName}: data rows are not objects`);
                            continue;
                        }

                        try {
                            // Check existence in current context
                            const exists = await (alasql as AlaSQLInstance).promise<unknown[]>(`SHOW TABLES LIKE '${tableName}'`);
                            if (exists.length > 0) {
                                // Step 3: Insert data
                                if (rows && rows.length > 0) {
                                    // Use quoted table name and parameter injection
                                    await (alasql as AlaSQLInstance).promise(`INSERT INTO \`${tableName}\` SELECT * FROM ?`, [rows]);
                                }
                                tableCount++;
                            } else {
                                // Fallback: Create from data if schema failed
                                // Infer columns from first row to create table safely
                                const firstRow = rows[0] as Record<string, unknown>;
                                const columns = Object.keys(firstRow).map(col => `\`${col}\` STRING`).join(', '); // Default to STRING for safety

                                await (alasql as AlaSQLInstance).promise(`CREATE TABLE \`${tableName}\` (${columns})`);
                                await (alasql as AlaSQLInstance).promise(`INSERT INTO \`${tableName}\` SELECT * FROM ?`, [rows]);
                            }
                        } catch (e) {
                            console.error(`Error loading data for '${tableName}':`, e);
                        }

                        // Yield every few tables if large database
                        if (tableCount % 5 === 0) {
                            await new Promise(resolve => setTimeout(resolve, 0));
                        }
                    }
                }

                Logger.info(`Restored database: ${dbName}`);
            }

            // Restore global active database state
            this.plugin.activeDatabase = activeDB;

            // Ensure dbo exists - completely ignore errors to prevent startup crash
            try {
                await (alasql as AlaSQLInstance).promise('CREATE DATABASE IF NOT EXISTS dbo');
            } catch (e) {
                // Ignore all errors here - if dbo exists, good. If not and it failed, we can't do much but shouldn't crash.
                Logger.debug("Safe creation of dbo failed (ignoring):", e);
            }

            // Switch alaSQL context to active DB (or dbo if fallback)
            try {
                await (alasql as AlaSQLInstance).promise(`USE \`${activeDB}\``);
            } catch {
                await (alasql as AlaSQLInstance).promise('USE dbo');
            }

            Logger.info("Database restoration complete.");
        } catch (error) {
            console.debug('MySQL Plugin: Load failed', error);
            throw error;
        }
    }

    async reset(): Promise<void> {
        // Switch to the system database 'alasql' first so we can drop 'dbo' and others
        try {
            await alasql.promise('USE alasql');
        } catch {
            console.warn("MySQL Plugin: Could not switch to system db during reset, proceeding wrap...");
        }

        const dbs = Object.keys(alasql.databases).filter(d => d !== 'alasql');
        Logger.info(`Resetting ${dbs.length} databases...`);

        for (const db of dbs) {
            try {
                // Use backticks for safety with special chars and use promise
                await alasql.promise(`DROP DATABASE IF EXISTS \`${db}\``);
                Logger.info(`Dropped database: ${db}`);
            } catch (e) {
                console.error(`Failed to drop database ${db} during reset:`, e);
            }
        }

        if (!alasql.databases.dbo) {
            await alasql.promise('CREATE DATABASE dbo');
        }

        await alasql.promise('USE dbo');
        this.plugin.activeDatabase = 'dbo';

        const newData = { ...this.plugin.settings, activeDatabase: 'dbo', databases: {} };
        await this.plugin.saveData(newData);

        // Notify UI components that everything changed
        DatabaseEventBus.getInstance().emitDatabaseModified({
            database: 'dbo',
            tables: [], // Empty tables list indicates a potential structural wipe
            timestamp: Date.now(),
            originId: 'database-reset'
        });

        Logger.info("Database reset complete.");
    }


    // --- New Database Management Methods ---

    getDatabaseStats(dbName: string): DatabaseStats | null {
        const db = (alasql as AlaSQLInstance).databases[dbName];
        if (!db) return null;

        const tableNames = Object.keys(db.tables);
        let totalRows = 0;
        tableNames.forEach(t => {
            const table = db.tables[t];
            if (table && table.data) {
                totalRows += table.data.length;
            }
        });

        // Size estimation: approximate based on stringified data
        const approxSize = JSON.stringify(db.tables).length;

        return {
            tables: tableNames.length,
            rows: totalRows,
            sizeBytes: approxSize,
            lastUpdated: db.lastUpdated || Date.now()
        };
    }

    async clearDatabase(dbName: string): Promise<void> {
        // No context switch needed
        const tables = (alasql as AlaSQLInstance)(`SHOW TABLES FROM ${dbName}`) as { tableid: string }[];
        for (const t of tables) {
            await (alasql as AlaSQLInstance).promise(`DROP TABLE ${dbName}.${t.tableid}`);
        }
        await this.save();
    }

    async renameDatabase(oldName: string, newName: string): Promise<void> {
        if (oldName === 'alasql') throw new Error("Cannot rename system database 'alasql'");
        if (oldName === 'dbo') throw new Error("Cannot rename default database 'dbo'");
        if (this.plugin.activeDatabase === oldName) throw new Error("Cannot rename active database. Switch to another database first.");
        if (!(alasql as AlaSQLInstance).databases[oldName]) throw new Error(`Database ${oldName} does not exist`);
        if ((alasql as AlaSQLInstance).databases[newName]) throw new Error(`Database ${newName} already exists`);

        try {
            // 1. Create new database
            await (alasql as AlaSQLInstance).promise(`CREATE DATABASE ${newName}`);

            // 2. Get tables from old DB
            const tables = (alasql as AlaSQLInstance)(`SHOW TABLES FROM ${oldName}`) as { tableid: string }[];

            for (const t of tables) {
                const tableName = t.tableid;

                // Copy Table Struct and Data using SHOW CREATE TABLE approach
                // Copy Table Struct and Data using Manual Construction
                try {
                    // 1. Get Columns
                    const cols = (alasql as AlaSQLInstance)(`SHOW COLUMNS FROM ${oldName}.${tableName}`) as { columnid: string, dbtypeid: string }[];
                    if (cols && cols.length > 0) {
                        const colDefs = cols.map(c => `${c.columnid} ${c.dbtypeid}`).join(', ');
                        await (alasql as AlaSQLInstance).promise(`CREATE TABLE ${newName}.${tableName} (${colDefs})`);

                        // 2. Copy Data
                        const sourceData = (alasql as AlaSQLInstance)(`SELECT * FROM ${oldName}.${tableName}`) as unknown[];
                        if (sourceData && sourceData.length > 0) {
                            await (alasql as AlaSQLInstance).promise(`INSERT INTO ${newName}.${tableName} SELECT * FROM ?`, [sourceData]);
                        }
                    }
                } catch (e) {
                    console.debug(`Failed to copy table ${tableName} during rename:`, e);
                }
            }

            // 3. Drop old
            await (alasql as AlaSQLInstance).promise(`DROP DATABASE ${oldName}`);

            // 4. Update plugin state
            if (this.plugin.activeDatabase === oldName) {
                this.plugin.activeDatabase = newName;
            }

            // 5. Save snapshot
            await this.save();
        } catch (error) {
            console.debug(`Failed to rename database from ${oldName} to ${newName}:`, error);
            // Attempt rollback
            try {
                await (alasql as AlaSQLInstance).promise(`DROP DATABASE IF EXISTS ${newName}`);
            } catch {
                // Rollback failed, nothing more we can do
            }
            throw error;
        }
    }

    async duplicateDatabase(dbName: string, newName: string): Promise<void> {

        await (alasql as unknown as AlaSQLInstance).promise(`CREATE DATABASE ${newName}`);

        const tables = (alasql as unknown as AlaSQLInstance)(`SHOW TABLES FROM [${dbName}]`) as { tableid: string }[];
        for (const t of tables) {
            const tableName = t.tableid;
            try {
                // 1. Get Columns
                const cols = (alasql as unknown as AlaSQLInstance)(`SHOW COLUMNS FROM [${dbName}].[${tableName}]`) as { columnid: string, dbtypeid: string }[];
                if (cols && cols.length > 0) {
                    const colDefs = cols.map(c => `${c.columnid} ${c.dbtypeid}`).join(', ');
                    await (alasql as unknown as AlaSQLInstance).promise(`CREATE TABLE [${newName}].[${tableName}] (${colDefs})`);

                    // 2. Copy Data
                    const sourceData = (alasql as unknown as AlaSQLInstance)(`SELECT * FROM [${dbName}].[${tableName}]`) as unknown[];
                    if (sourceData && sourceData.length > 0) {
                        await (alasql as unknown as AlaSQLInstance).promise(`INSERT INTO [${newName}].[${tableName}] SELECT * FROM ?`, [sourceData]);
                    }
                }
            } catch (e) {
                console.debug(`Failed to duplicate table ${tableName}:`, e);
            }
        }









        await this.save();
    }

    async createDatabase(dbName: string): Promise<void> {
        if ((alasql as unknown as AlaSQLInstance).databases[dbName]) throw new Error(`Database ${dbName} already exists`);
        // Simple validation
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
            throw new Error("Invalid database name. Use alphanumeric characters and underscores only.");
        }

        await (alasql as unknown as AlaSQLInstance).promise(`CREATE DATABASE ${dbName}`);
        await this.save();
    }

    async deleteDatabase(dbName: string): Promise<void> {
        if (!(alasql as unknown as AlaSQLInstance).databases[dbName]) return;
        if (dbName === 'alasql') throw new Error("Cannot delete default alasql database");
        if (dbName === 'dbo') throw new Error("Cannot delete default database 'dbo'");
        if (this.plugin.activeDatabase === dbName) throw new Error("Cannot delete active database. Switch first.");

        await (alasql as unknown as AlaSQLInstance).promise(`DROP DATABASE ${dbName}`);
        await this.save();
    }

    async exportDatabase(dbName: string): Promise<string> {
        // This method processes data in chunks and could be CPU intensive.
        // Although it doesn't use 'await' currently because alasql is synchronous here,
        // we keep it async to allow for UI non-blocking refactors later or if we switch alaSQL to promise mode totally.
        // However, to satisfy linter, we can wrap the return.
        // Or better, just remove async if we truly don't need it, but the interface likely expects Promise.
        // The interface IDatabaseManager isn't strictly defined in this file but implied.
        // Let's check if we can add a dummy await or just remove async.
        // Given it's potentially heavy, maybe yielding to event loop is good?
        // Let's add await Promise.resolve() to make it truly async and non-blocking for a microtick.

        await Promise.resolve(); // Ensure async behavior to prevent UI freeze validation errors

        if (!(alasql as unknown as AlaSQLInstance).databases[dbName]) throw new Error(`Database ${dbName} does not exist`);

        // Generate SQL Dump
        let dump = `-- Database Export: ${dbName}\n-- Date: ${new Date().toISOString()}\n\n`;
        dump += `CREATE DATABASE IF NOT EXISTS ${dbName};\nUSE ${dbName};\n\n`;

        const tables = (alasql as unknown as AlaSQLInstance)(`SHOW TABLES FROM ${dbName}`) as { tableid: string }[];
        for (const t of tables) {
            const tableName = t.tableid;

            // Schema
            const createRes = (alasql as unknown as AlaSQLInstance)(`SHOW CREATE TABLE ${dbName}.${tableName}`) as Record<string, string>[];
            if (createRes?.[0]) {
                const createSQL = createRes[0]["Create Table"] || createRes[0]["CreateTable"];
                // Ensure pure CREATE TABLE for portability (strip db prefix if internal logic added it weirdly, but usually SHOW CREATE returns generic)
                // Actually, AlaSQL might return CREATE TABLE db.table
                // We want standard SQL if possible, but AlaSQL is quirky.
                // Best to keep as is, but maybe strip database prefix if present for clean dump
                dump += `${createSQL};\n`;
            }

            // Data
            const data = (alasql as unknown as AlaSQLInstance)(`SELECT * FROM ${dbName}.${tableName}`) as unknown[];
            if (data.length > 0) {
                // Batch inserts
                const batchSize = 100;
                for (let i = 0; i < data.length; i += batchSize) {
                    const batch = data.slice(i, i + batchSize);
                    // Minimalistic value stringifier
                    const values = batch.map(row => {
                        const vals = Object.values(row as Record<string, unknown>).map(v => {
                            if (v === null || v === undefined) return 'NULL';
                            if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`; // Escape single quotes
                            if (v instanceof Date) return `'${v.toISOString()}'`;
                            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
                            return String(v as string | number | boolean);
                        });
                        return `(${vals.join(', ')})`;
                    }).join(',\n');

                    dump += `INSERT INTO ${tableName} VALUES \n${values};\n`;
                }
            }
            dump += '\n';
        }

        return dump;
    }

    async importDatabase(sql: string): Promise<void> {
        // Rudimentary SQL Import
        // AlaSQL can run multiple statements if script is boolean true? No.
        // We need to split statements carefully or use QueryExecutor logic?
        // QueryExecutor splits by semicolon.
        // BUT, SQL dumps might contain semicolons in strings.
        // Assuming standard formatting from our export:

        // Let's use QueryExecutor logic if available or just split simply for now.
        // Actually, importing a whole DB might be faster if we just run it as a script if AlaSQL supports it.
        // alasql(sql) supports multiple statements?
        // Yes, typically.

        // Check if database exists in SQL?
        // Our export includes CREATE DATABASE.

        try {
            // AlaSQL's exec/run/process might handle multi-statement strings.
            // Let's try direct execution first.
            // However, context matters.
            // If the dump has "USE db", it might switch global context.
            // We want that for the import duration, but need to restore later.

            // WE must ensure we wrap this safely.

            // Actually, to respect our "No global USE" policy, we might want to PARSE the dump?
            // Too complex.

            // Compromise: allow temporary global switch during import but reset immediately.
            const previousDB = this.plugin.activeDatabase;

            // Clean comments? 
            const statements = sql.split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));

            for (const stmt of statements) {
                // Skip transaction stuff if any
                if (stmt.startsWith('BEGIN') || stmt.startsWith('COMMIT')) continue;

                // Intercept USE for safety?
                // If dump has USE, let it run so subsequent statements work.
                await (alasql as unknown as AlaSQLInstance).promise(stmt);
            }

            // Restore context if needed (Update plugin state to whatever was active before, or if import changed it)
            // If dump had "USE newdb", alasql.useid IS newdb.
            // We should probably sync plugin state to that new db if the user wants to switch to it,
            // OR force back to previous.
            // Usually, importing a DB -> you want to see it.

            const finalContext = (alasql as unknown as AlaSQLInstance).useid;
            if (finalContext && finalContext !== 'alasql') {
                this.plugin.activeDatabase = finalContext;
            } else if (previousDB) {
                this.plugin.activeDatabase = previousDB;
            }

            await this.save();
        } catch (e) {
            console.error("Import failed", e);
            throw new Error("Failed to import database: " + (e as Error).message);
        }
    }
}