// @ts-ignore
import alasql from 'alasql';
import { IMySQLPlugin, DatabaseSnapshot, DatabaseContent } from '../types';
import { Logger } from '../utils/Logger';

export class DatabaseManager {
    private isSaving: boolean = false;
    private pendingSave: boolean = false;

    constructor(private plugin: IMySQLPlugin) { }

    async save(): Promise<void> {
        if (this.isSaving) {
            console.log('MySQL Plugin: Save already in progress, marking pending...');
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

            console.log('MySQL Plugin: Database saved successfully (Atomic)');
        } catch (error) {
            console.error('MySQL Plugin: Save failed', error);
            throw error;
        } finally {
            this.isSaving = false;
            // Check if a save was requested while we were saving
            if (this.pendingSave) {
                console.log('MySQL Plugin: Processing pending save...');
                this.save();
            }
        }
    }

    private async createSnapshot(): Promise<DatabaseSnapshot> {
        const activeDatabase = alasql.useid || 'alasql';
        const databases = Object.keys(alasql.databases);
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

                        // Generate Schema
                        try {
                            // Method 1: Try stored create sql if alasql keeps it (unlikely but possible)
                            // Method 2: Generate from data structure
                            if (rows.length > 0) {
                                const firstRow = rows[0];
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

        if (alasql.databases[activeDatabase]) {
            alasql(`USE ${activeDatabase}`);
        }

        return snapshot;
    }

    async load(): Promise<void> {
        const data = await this.plugin.loadData();

        console.log('MySQL Plugin: Starting database load...');
        if (!data?.databases) {
            console.log('MySQL Plugin: No databases found in saved data');
            return;
        }

        try {
            const activeDB = data.activeDatabase || data.currentDB || 'dbo';
            let restoredTablesCount = 0;

            for (const [dbName, content] of Object.entries(data.databases)) {
                const db = content as any;

                if (!db.tables && !db.schema) continue;

                if (!alasql.databases[dbName]) {
                    await alasql.promise(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
                }
                await alasql.promise(`USE ${dbName}`);

                if (db.schema) {
                    for (const [tableName, sql] of Object.entries(db.schema)) {
                        try {
                            await alasql.promise(`DROP TABLE IF EXISTS ${tableName}`);
                            await alasql.promise(String(sql));
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
                            const exists = await alasql.promise(`SHOW TABLES LIKE '${tableName}'`) as any[];
                            if (exists.length > 0) {
                                const batchSize = 1000;
                                for (let i = 0; i < (rows as any[]).length; i += batchSize) {
                                    const batch = (rows as any[]).slice(i, i + batchSize);
                                    await alasql.promise(`INSERT INTO ${tableName} SELECT * FROM ?`, [batch]);
                                }
                            }
                        } catch (e) {
                            console.error(`Error loading data for '${tableName}':`, e);
                        }
                    }
                }
            }

            if (alasql.databases[activeDB]) {
                await alasql.promise(`USE ${activeDB}`);
                this.plugin.activeDatabase = activeDB;
            } else {
                const availableDBs = Object.keys(alasql.databases).filter(d => d !== 'alasql');
                if (availableDBs.length > 0) {
                    // Fix: prefer dbo if available as fallback
                    const fallbackDB = availableDBs.includes('dbo') ? 'dbo' : availableDBs[0];
                    await alasql.promise(`USE ${fallbackDB}`);
                    this.plugin.activeDatabase = fallbackDB;
                } else {
                    // Create dbo if nothing exists
                    await alasql.promise('CREATE DATABASE dbo');
                    await alasql.promise('USE dbo');
                    this.plugin.activeDatabase = 'dbo';
                }
            }

            // Explicitly sync alasql context with plugin state to prevent leakage
            console.log(`MySQL Plugin: Loaded. Active: ${this.plugin.activeDatabase}, Alasql useid: ${alasql.useid}`);
        } catch (error) {
            console.error('MySQL Plugin: Load failed', error);
            throw error;
        }
    }

    async reset(): Promise<void> {
        const dbs = Object.keys(alasql.databases).filter(d => d !== 'alasql');
        for (const db of dbs) {
            try {
                alasql(`DROP DATABASE IF EXISTS ${db}`);
            } catch (e) { }
        }

        if (!alasql.databases.dbo) alasql('CREATE DATABASE dbo');
        alasql('USE dbo');
        this.plugin.activeDatabase = 'dbo';

        const newData = { ...this.plugin.settings, activeDatabase: 'dbo', databases: {} };
        await this.plugin.saveData(newData);
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
        const currentDB = alasql.useid;
        await alasql.promise(`USE ${dbName}`);
        const tables = alasql("SHOW TABLES") as any[];
        for (const t of tables) {
            await alasql.promise(`DROP TABLE ${t.tableid}`);
        }
        if (currentDB) await alasql.promise(`USE ${currentDB}`);
        await this.save();
    }

    async renameDatabase(oldName: string, newName: string): Promise<void> {
        if (alasql.databases[newName]) throw new Error(`Database ${newName} already exists`);

        try {
            const currentDB = alasql.useid; // Capture original context

            // 1. Switch to old DB and collect all data/schemas first
            // This prevents context confusion during the creation phase
            await alasql.promise(`USE ${oldName}`);
            const tables = alasql("SHOW TABLES") as any[];

            const collectedData: Array<{ tableName: string, createSQL: string, data: any[] }> = [];

            for (const t of tables) {
                const tableName = t.tableid;

                // Get Schema
                const createRes = alasql(`SHOW CREATE TABLE ${tableName}`) as any[];
                let createSQL = "";

                if (createRes?.[0]) {
                    createSQL = createRes[0]["Create Table"] || createRes[0]["CreateTable"];
                }

                if (!createSQL) {
                    // Fallback if SHOW CREATE fails (shouldn't happen if we are in correct context)
                    console.warn(`Could not get schema for ${tableName}, skipping copy.`);
                    continue;
                }

                // Get Data
                const data = (await alasql.promise(`SELECT * FROM ${tableName}`)) as any[];
                collectedData.push({ tableName, createSQL, data });
            }

            // 2. Create new database
            await alasql.promise(`CREATE DATABASE ${newName}`);
            await alasql.promise(`USE ${newName}`);

            // 3. Restore tables and data in new DB
            for (const item of collectedData) {
                await alasql.promise(item.createSQL);
                if (item.data.length > 0) {
                    await alasql.promise(`INSERT INTO ${item.tableName} SELECT * FROM ?`, [item.data]);
                }
            }

            // 4. Update plugin state if needed
            if (this.plugin.activeDatabase === oldName) {
                this.plugin.activeDatabase = newName;
                // Already in newName from step 2
            } else {
                // Restore previous context if it wasn't the one we renamed
                if (currentDB === oldName) {
                    await alasql.promise(`USE ${newName}`);
                } else if (currentDB) {
                    await alasql.promise(`USE ${currentDB}`);
                }
            }

            // 5. Drop old
            await alasql.promise(`DROP DATABASE ${oldName}`);

            // 6. Save snapshot
            await this.save();
        } catch (error) {
            console.error(`Failed to rename database from ${oldName} to ${newName}:`, error);
            // Attempt rollback: Drop new database if it was created
            if (alasql.databases[newName]) {
                await alasql.promise(`DROP DATABASE ${newName}`);
            }
            throw error;
        }
    }

    async duplicateDatabase(dbName: string, newName: string): Promise<void> {
        if (alasql.databases[newName]) throw new Error(`Database ${newName} already exists`);

        const currentDB = alasql.useid;
        await alasql.promise(`CREATE DATABASE ${newName}`);

        const tables = alasql(`SHOW TABLES FROM ${dbName}`) as any[];
        for (const t of tables) {
            const tableName = t.tableid;
            const createRes = alasql(`SHOW CREATE TABLE ${dbName}.${tableName}`) as any[];
            if (createRes?.[0]) {
                const createSQL = createRes[0]["Create Table"] || createRes[0]["CreateTable"];
                await alasql.promise(`USE ${newName}`);
                await alasql.promise(createSQL);
                await alasql.promise(`INSERT INTO ${newName}.${tableName} SELECT * FROM ${dbName}.${tableName}`);
            }
        }

        if (currentDB) await alasql.promise(`USE ${currentDB}`);
        await this.save();
    }

    async deleteDatabase(dbName: string): Promise<void> {
        if (!alasql.databases[dbName]) return;
        if (dbName === 'alasql') throw new Error("Cannot delete default alasql database");
        if (this.plugin.activeDatabase === dbName) throw new Error("Cannot delete active database. Switch first.");

        await alasql.promise(`DROP DATABASE ${dbName}`);
        await this.save();
    }
}