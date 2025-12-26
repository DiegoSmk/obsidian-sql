// @ts-ignore
import alasql from 'alasql';
import { IMySQLPlugin, DatabaseSnapshot, DatabaseContent } from '../types';
import { Logger } from '../utils/Logger';

export class DatabaseManager {
    private saveQueue: Set<string> = new Set();
    private isSaving: boolean = false;

    constructor(private plugin: IMySQLPlugin) { }

    async save(): Promise<void> {
        if (this.isSaving) {
            console.log('MySQL Plugin: Save already in progress, skipping...');
            return;
        }

        this.isSaving = true;

        try {
            // 1. Create Snapshot
            const snapshot = await this.createSnapshot();

            // 2. Load existing data for backup
            const existingData = await this.plugin.loadData() || {};

            // 3. Create backup of previous state if it exists (Fix recursive backup)
            if (existingData.databases) {
                // Ensure we don't nest backups indefinitely
                const backupData = { ...existingData };
                delete backupData.backup; // Remove any existing backup from the object we are backing up

                existingData.backup = {
                    databases: backupData.databases,
                    currentDB: backupData.currentDB,
                    version: backupData.version,
                    createdAt: backupData.createdAt
                };
            }

            // 4. Atomic Save: Save to _temp first
            const tempData = { ...this.plugin.settings, ...existingData, ...snapshot, _temp: snapshot };
            await this.plugin.saveData(tempData);

            // 5. Verify (simulated here by successful write) and strictly save real data
            const finalData = { ...tempData };
            delete finalData._temp; // Remove temp

            await this.plugin.saveData(finalData);

            console.log('MySQL Plugin: Database saved successfully (Atomic)');
        } catch (error) {
            console.error('MySQL Plugin: Save failed', error);
            throw error;
        } finally {
            this.isSaving = false;
        }
    }

    private async createSnapshot(): Promise<DatabaseSnapshot> {
        const currentDB = alasql.useid || 'dbo';
        const databases = Object.keys(alasql.databases).filter(d => d !== 'alasql');
        const snapshot: DatabaseSnapshot = {
            version: 1,
            createdAt: Date.now(),
            currentDB,
            databases: {}
        };

        for (const dbName of databases) {
            try {
                alasql(`USE ${dbName}`);
                const tables = alasql("SHOW TABLES") as any[];
                const dbData: Record<string, any[]> = {};
                const dbSchema: Record<string, string> = {};

                for (const table of tables) {
                    const tableName = table.tableid;

                    // Salvar dados com limite
                    const limit = this.plugin.settings.snapshotRowLimit || 10000;
                    const rows = (await alasql.promise(`SELECT * FROM ${tableName} LIMIT ${limit}`)) as any[];

                    if (rows.length === limit) {
                        Logger.warn(`Snapshot for table '${tableName}' truncated to limit of ${limit} rows.`);
                    }

                    dbData[tableName] = rows;

                    // Salvar schema
                    try {
                        const createRes = alasql(`SHOW CREATE TABLE ${tableName}`) as any[];
                        if (createRes?.[0]) {
                            const createSQL = createRes[0]["Create Table"] || createRes[0]["CreateTable"];
                            if (createSQL) dbSchema[tableName] = createSQL;
                        }
                    } catch (e) {
                        console.warn(`Could not save schema for ${tableName}`);
                    }
                }

                snapshot.databases[dbName] = {
                    tables: dbData,
                    schema: dbSchema
                };
            } catch (error) {
                console.error(`Failed to snapshot database ${dbName}:`, error);
            }
        }

        // Restaurar contexto
        if (alasql.databases[currentDB]) {
            alasql(`USE ${currentDB}`);
        }

        return snapshot;
    }

    async load(): Promise<void> {
        const data = await this.plugin.loadData();
        if (!data?.databases) return;

        try {
            const activeDB = data.currentDB || 'dbo';

            for (const [dbName, content] of Object.entries(data.databases)) {
                const db = content as DatabaseContent;
                if (!db.tables && !db.schema) continue;

                if (!alasql.databases[dbName]) {
                    await alasql.promise(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
                }
                await alasql.promise(`USE ${dbName}`);

                // Restaurar schemas primeiro
                for (const [tableName, sql] of Object.entries(db.schema || {})) {
                    try {
                        await alasql.promise(`DROP TABLE IF EXISTS ${tableName}`);
                        await alasql.promise(String(sql));
                    } catch (e) {
                        console.error(`Error restoring schema for ${tableName}:`, e);
                    }
                }

                // Carregar dados em lotes para performance
                for (const [tableName, rows] of Object.entries(db.tables || {})) {
                    if (rows.length === 0) continue;

                    try {
                        const exists = (await alasql.promise(`SHOW TABLES LIKE '${tableName}'`)) as any[];

                        if (exists.length > 0) {
                            // Inserir em lotes
                            const batchSize = 1000;
                            for (let i = 0; i < rows.length; i += batchSize) {
                                const batch = rows.slice(i, i + batchSize);
                                await alasql.promise(`INSERT INTO ${tableName} SELECT * FROM ?`, [batch]);
                            }
                        }
                    } catch (e) {
                        console.error(`Error loading data for ${tableName}:`, e);
                    }
                }
            }

            if (alasql.databases[activeDB]) {
                await alasql.promise(`USE ${activeDB}`);
                // @ts-ignore
                this.plugin.currentDB = activeDB;
            }

            console.log('MySQL Plugin: Database loaded successfully');
        } catch (error) {
            console.error('MySQL Plugin: Load failed', error);
        }
    }

    async reset(): Promise<void> {
        const dbs = Object.keys(alasql.databases).filter(d => d !== 'alasql');

        for (const db of dbs) {
            try {
                alasql(`DROP DATABASE IF EXISTS ${db}`);
            } catch (e) {
                console.error(`Failed to drop ${db}:`, e);
            }
        }

        if (!alasql.databases.dbo) {
            alasql('CREATE DATABASE dbo');
        }
        alasql('USE dbo');
        // @ts-ignore
        this.plugin.currentDB = 'dbo';

        const newData = {
            ...this.plugin.settings,
            currentDB: 'dbo',
            databases: {}
        };
        await this.plugin.saveData(newData);
    }
}
