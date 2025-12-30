// @ts-ignore
import alasql from 'alasql';
import { IMySQLPlugin, DatabaseSnapshot, DatabaseContent, AlaSQLTable } from '../types';
import { Logger } from '../utils/Logger';
import { DatabaseEventBus } from './DatabaseEventBus';


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
            const existingData = await this.plugin.loadData() || {};

            if (existingData.databases) {
                const backupData = { ...existingData };
                delete backupData.backup;

                existingData.backup = {
                    databases: backupData.databases,
                    activeDatabase: backupData.activeDatabase || backupData.currentDB,
                    version: backupData.version,
                    createdAt: backupData.createdAt
                };
            }

            const tempData = { ...this.plugin.settings, ...existingData, ...snapshot, _temp: snapshot };
            await this.plugin.saveData(tempData);

            const finalData = { ...tempData };
            delete finalData._temp;

            await this.plugin.saveData(finalData);

        } catch (error) {
            console.error('MySQL Plugin: Save failed', error);
            throw error;
        } finally {
            this.isSaving = false;
            // Check if a save was requested while we were saving
            if (this.pendingSave) {
                this.save();
            }
        }
    }

    private async createSnapshot(): Promise<DatabaseSnapshot> {
        const activeDatabase = this.plugin.activeDatabase || 'dbo';
        // Filter out default alasql database to prevent duplication/pollution
        const databases = Object.keys(alasql.databases).filter(d => d !== 'alasql');
        const snapshot: DatabaseSnapshot = {
            version: 1,
            createdAt: Date.now(),
            activeDatabase,
            databases: {}
        };

        for (const dbName of databases) {
            try {
                // Direct access - Safer than switching context
                const dbInstance = alasql.databases[dbName];
                if (!dbInstance) continue;

                const dbData: Record<string, any[]> = {};
                const dbSchema: Record<string, string> = {};

                if (dbInstance.tables) {
                    for (const tableName of Object.keys(dbInstance.tables)) {
                        const tableObj = dbInstance.tables[tableName] as AlaSQLTable;
                        const rows = tableObj.data || [];

                        const limit = this.plugin.settings.snapshotRowLimit || 10000;

                        // Copy data (sliced to limit)
                        if (rows.length > limit) {
                            Logger.warn(`Snapshot for table '${tableName}' truncated to limit of ${limit} rows.`);
                            dbData[tableName] = rows.slice(0, limit);
                        } else {
                            dbData[tableName] = rows;
                        }

                        // Generate Schema from AlaSQL (Supports empty tables)
                        try {
                            const createRes = alasql(`SHOW CREATE TABLE ${dbName}.${tableName}`) as any[];
                            if (createRes?.[0]) {
                                dbSchema[tableName] = createRes[0]["Create Table"] || createRes[0]["CreateTable"];
                            }

                            // If SHOW CREATE failed but we have table object, try to reconstruct from columns (Essential for AUTO_INCREMENT)
                            if (!dbSchema[tableName] && tableObj.columns && tableObj.columns.length > 0) {
                                const colDefs = tableObj.columns.map((c: any) => {
                                    let def = `\`${c.columnid}\` ${c.dbtypeid || 'VARCHAR'}`;
                                    if (c.primarykey) def += ' PRIMARY KEY';
                                    if (c.auto_increment || c.autoincrement || c.identity) def += ' AUTO_INCREMENT';
                                    return def;
                                }).join(', ');
                                dbSchema[tableName] = `CREATE TABLE \`${tableName}\` (${colDefs})`;
                            } else if (!dbSchema[tableName] && rows.length > 0) {
                                // Fallback: Generate from data structure if SHOW CREATE and columns fail
                                const firstRow = rows[0] as any;
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

                                // Alert user about fallback (Potential loss of AUTO_INCREMENT/Constraints)
                                Logger.warn(`[DATA INTEGRITY] Imperfect schema restoration for '${tableName}'. Table structure was inferred from data, meaning constraints like PRIMARY KEY or AUTO_INCREMENT are likely missing. Manual schema definition is recommended.`);
                            }
                        } catch (e) {
                            console.error(`MySQL Plugin: Failed to generate schema for '${tableName}':`, e);
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
        const data = await this.plugin.loadData();

        if (!data?.databases) {
            return;
        }

        try {
            const activeDB = data.activeDatabase || data.currentDB || 'dbo';
            let restoredTablesCount = 0;

            for (const [dbName, content] of Object.entries(data.databases)) {
                if (dbName === 'alasql') continue; // Skip default/system db

                const db = content as any;

                if (!db.tables && !db.schema) continue;

                if (!alasql.databases[dbName]) {
                    await alasql.promise(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
                }

                // Temporary switch context for restoration
                await alasql.promise(`USE ${dbName}`);

                if (db.schema) {
                    for (const [tableName, sql] of Object.entries(db.schema)) {
                        try {
                            await alasql.promise(`DROP TABLE IF EXISTS ${dbName}.${tableName}`);
                            // Inject database name into CREATE TABLE
                            let createSQL = String(sql);
                            if (createSQL.toUpperCase().includes('CREATE TABLE')) {
                                // Robust replacement: matches optional [ " ` around the table name and avoids double prefixing
                                if (!createSQL.match(new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${dbName}\\.`, 'i'))) {
                                    createSQL = createSQL.replace(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\["`]?)([a-zA-Z0-9_]+)([\]"`]?)/i, `CREATE TABLE ${dbName}.$2`);
                                }
                            }
                            Logger.info(`Restored table schema: ${dbName}.${tableName}`);
                            await alasql.promise(createSQL);
                            restoredTablesCount++;
                        } catch (e) {
                            console.error(`Error restoring schema for '${tableName}':`, e);
                        }
                    }
                }

                if (db.tables) {
                    for (const [tableName, rows] of Object.entries(db.tables)) {
                        if (!rows || (rows as any[]).length === 0) continue;
                        try {
                            const exists = await alasql.promise(`SHOW TABLES FROM ${dbName} LIKE '${tableName}'`) as any[];
                            if (exists.length > 0) {
                                // Step 3: Insert data
                                if (rows && (rows as any[]).length > 0) {
                                    // Check if schema was provided for this table
                                    const hasSchema = db.schema && db.schema[tableName];
                                    if (hasSchema) {
                                        // If table was created via schema, use INSERT INTO to preserve constraints (like AUTO_INCREMENT)
                                        await alasql.promise(`INSERT INTO ${dbName}.${tableName} SELECT * FROM ?`, [rows]);
                                    } else {
                                        // Fallback: Create table from data if no schema was explicitly defined
                                        // This path is less ideal for AUTO_INCREMENT but handles cases where schema generation failed
                                        await alasql.promise(`SELECT * INTO ${dbName}.${tableName} FROM ?`, [rows]);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error(`Error loading data for '${tableName}':`, e);
                        }
                    }
                }
            }

            // No longer need to switch alaSQL context globally, we just update plugin state
            this.plugin.activeDatabase = activeDB;

            // Ensure alasql context is NOT stuck on a random DB if possible, or matches desired if critical
            // But user requested to AVOID context switching.
            // However, alasql.useid IS the global context.
            // QueryExecutor manages it virtually.
            // We should arguably set it to 'alasql' or just leave it.
            // But if we want to be safe, we don't touch it, or reset to default.
            // The previous code had complex logic to fallback to 'dbo'.
            // For now, we update internal plugin state and ensure dbo exists.

            if (!alasql.databases['dbo']) {
                await alasql.promise('CREATE DATABASE dbo');
            }

            // Explicitly sync alasql context with plugin state to prevent leakage
        } catch (error) {
            console.error('MySQL Plugin: Load failed', error);
            throw error;
        }
    }

    async reset(): Promise<void> {
        // Switch to the system database 'alasql' first so we can drop 'dbo' and others
        try {
            await alasql.promise('USE alasql');
        } catch (e) {
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

    getDatabaseStats(dbName: string): any {
        const db = alasql.databases[dbName];
        if (!db) return null;

        const tableNames = Object.keys(db.tables);
        let totalRows = 0;
        tableNames.forEach(t => {
            if (db.tables[t].data) {
                totalRows += db.tables[t].data.length;
            }
        });

        // Size estimation: approximate based on stringified data
        const approxSize = JSON.stringify(db.tables).length;

        return {
            tables: tableNames.length,
            rows: totalRows,
            sizeBytes: approxSize,
            lastUpdated: Date.now() // Ideally this would come from the last save, but for UI we use current
        };
    }

    async clearDatabase(dbName: string): Promise<void> {
        // No context switch needed
        const tables = alasql(`SHOW TABLES FROM ${dbName}`) as any[];
        for (const t of tables) {
            await alasql.promise(`DROP TABLE ${dbName}.${t.tableid}`);
        }
        await this.save();
    }

    async renameDatabase(oldName: string, newName: string): Promise<void> {
        if (oldName === 'alasql') throw new Error("Cannot rename system database 'alasql'");
        if (oldName === 'dbo') throw new Error("Cannot rename default database 'dbo'");
        if (this.plugin.activeDatabase === oldName) throw new Error("Cannot rename active database. Switch to another database first.");
        if (alasql.databases[newName]) throw new Error(`Database ${newName} already exists`);

        try {
            // 1. Create new database
            await alasql.promise(`CREATE DATABASE ${newName}`);

            // 2. Get tables from old DB
            const tables = alasql(`SHOW TABLES FROM ${oldName}`) as any[];

            for (const t of tables) {
                const tableName = t.tableid;

                // Copy Table Struct and Data
                // Since we can't easily modify "SHOW CREATE TABLE" output to be cross-db without parsing,
                // and alasql supports "CREATE TABLE new.tab AS SELECT * FROM old.tab" but that copies data + structure (sometimes without constraints)
                // A safer bet given alasql limitations:

                // Deep clone table using internal structures
                try {
                    const sourceData = alasql(`SELECT * FROM ${oldName}.\`${tableName}\``) as any[];
                    await alasql.promise(`CREATE TABLE ${newName}.\`${tableName}\``);
                    if (sourceData.length > 0) {
                        alasql.databases[newName].tables[tableName].data = JSON.parse(JSON.stringify(sourceData));
                    }
                } catch (e) {
                    console.error(`Failed to copy table ${tableName} during rename:`, e);
                }





            }

            // 3. Drop old
            await alasql.promise(`DROP DATABASE ${oldName}`);

            // 4. Update plugin state
            if (this.plugin.activeDatabase === oldName) {
                this.plugin.activeDatabase = newName;
            }

            // 5. Save snapshot
            await this.save();
        } catch (error) {
            console.error(`Failed to rename database from ${oldName} to ${newName}:`, error);
            // Attempt rollback
            try {
                await alasql.promise(`DROP DATABASE IF EXISTS ${newName}`);
            } catch (e) { }
            throw error;
        }
    }

    async duplicateDatabase(dbName: string, newName: string): Promise<void> {
        if (alasql.databases[newName]) throw new Error(`Database ${newName} already exists`);

        await alasql.promise(`CREATE DATABASE ${newName}`);

        const tables = alasql(`SHOW TABLES FROM ${dbName}`) as any[];
        for (const t of tables) {
            const tableName = t.tableid;
            try {
                const sourceData = alasql(`SELECT * FROM ${dbName}.\`${tableName}\``) as any[];
                await alasql.promise(`CREATE TABLE ${newName}.\`${tableName}\``);
                if (sourceData.length > 0) {
                    alasql.databases[newName].tables[tableName].data = JSON.parse(JSON.stringify(sourceData));
                }
            } catch (e) {
                console.error(`Failed to duplicate table ${tableName}:`, e);
            }
        }






        await this.save();
    }

    async createDatabase(dbName: string): Promise<void> {
        if (alasql.databases[dbName]) throw new Error(`Database ${dbName} already exists`);
        // Simple validation
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
            throw new Error("Invalid database name. Use alphanumeric characters and underscores only.");
        }

        await alasql.promise(`CREATE DATABASE ${dbName}`);
        await this.save();
    }

    async deleteDatabase(dbName: string): Promise<void> {
        if (!alasql.databases[dbName]) return;
        if (dbName === 'alasql') throw new Error("Cannot delete default alasql database");
        if (dbName === 'dbo') throw new Error("Cannot delete default database 'dbo'");
        if (this.plugin.activeDatabase === dbName) throw new Error("Cannot delete active database. Switch first.");

        await alasql.promise(`DROP DATABASE ${dbName}`);
        await this.save();
    }

    async exportDatabase(dbName: string): Promise<string> {
        if (!alasql.databases[dbName]) throw new Error(`Database ${dbName} does not exist`);

        // Generate SQL Dump
        let dump = `-- Database Export: ${dbName}\n-- Date: ${new Date().toISOString()}\n\n`;
        dump += `CREATE DATABASE IF NOT EXISTS ${dbName};\nUSE ${dbName};\n\n`;

        const tables = alasql(`SHOW TABLES FROM ${dbName}`) as any[];
        for (const t of tables) {
            const tableName = t.tableid;

            // Schema
            const createRes = alasql(`SHOW CREATE TABLE ${dbName}.${tableName}`) as any[];
            if (createRes?.[0]) {
                let createSQL = createRes[0]["Create Table"] || createRes[0]["CreateTable"];
                // Ensure pure CREATE TABLE for portability (strip db prefix if internal logic added it weirdly, but usually SHOW CREATE returns generic)
                // Actually, AlaSQL might return CREATE TABLE db.table
                // We want standard SQL if possible, but AlaSQL is quirky.
                // Best to keep as is, but maybe strip database prefix if present for clean dump
                dump += `${createSQL};\n`;
            }

            // Data
            const data = alasql(`SELECT * FROM ${dbName}.${tableName}`) as any[];
            if (data.length > 0) {
                // Batch inserts
                const batchSize = 100;
                for (let i = 0; i < data.length; i += batchSize) {
                    const batch = data.slice(i, i + batchSize);
                    // Minimalistic value stringifier
                    const values = batch.map(row => {
                        const vals = Object.values(row).map(v => {
                            if (v === null || v === undefined) return 'NULL';
                            if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`; // Escape single quotes
                            if (v instanceof Date) return `'${v.toISOString()}'`;
                            return v;
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
                await alasql.promise(stmt);
            }

            // Restore context if needed (Update plugin state to whatever was active before, or if import changed it)
            // If dump had "USE newdb", alasql.useid IS newdb.
            // We should probably sync plugin state to that new db if the user wants to switch to it,
            // OR force back to previous.
            // Usually, importing a DB -> you want to see it.

            if (alasql.useid && alasql.useid !== 'alasql') {
                this.plugin.activeDatabase = alasql.useid;
            } else if (previousDB) {
                this.plugin.activeDatabase = previousDB;
            }

            await this.save();
        } catch (e) {
            console.error("Import failed", e);
            throw new Error("Failed to import database: " + e.message);
        }
    }
}