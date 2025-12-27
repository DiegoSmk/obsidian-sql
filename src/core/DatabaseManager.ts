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
                alasql(`USE ${dbName}`);
                const tables = alasql("SHOW TABLES") as any[];
                const dbData: Record<string, any[]> = {};
                const dbSchema: Record<string, string> = {};

                for (const table of tables) {
                    const tableName = table.tableid;

                    const limit = this.plugin.settings.snapshotRowLimit || 10000;
                    const rows = (await alasql.promise(`SELECT * FROM ${tableName} LIMIT ${limit}`)) as any[];

                    if (rows.length === limit) {
                        Logger.warn(`Snapshot for table '${tableName}' truncated to limit of ${limit} rows.`);
                    }

                    dbData[tableName] = rows;

                    // FIXED: Generate schema from table structure instead of SHOW CREATE TABLE
                    try {
                        // Method 1: Try SHOW CREATE TABLE (might not work in AlaSQL)
                        const createRes = alasql(`SHOW CREATE TABLE ${tableName}`) as any[];
                        if (createRes?.[0]) {
                            const createSQL = createRes[0]["Create Table"] || createRes[0]["CreateTable"];
                            if (createSQL) {
                                dbSchema[tableName] = createSQL;
                                console.log(`MySQL Plugin: Schema saved for '${tableName}' via SHOW CREATE TABLE`);
                                continue;
                            }
                        }
                    } catch (e) {
                        // Fallback: Generate schema from data structure
                    }

                    // Method 2: Generate schema from table structure
                    try {
                        if (rows.length > 0) {
                            const firstRow = rows[0];
                            const columns = Object.keys(firstRow).map(col => {
                                const value = firstRow[col];
                                let type = 'VARCHAR';

                                if (value === null || value === undefined) {
                                    // Default to VARCHAR for nulls to be safe
                                    type = 'VARCHAR';
                                } else if (typeof value === 'number') {
                                    type = Number.isInteger(value) ? 'INT' : 'FLOAT';
                                } else if (typeof value === 'boolean') {
                                    type = 'BOOLEAN';
                                } else if (value instanceof Date) {
                                    type = 'DATE';
                                }

                                return `\`${col}\` ${type}`;
                            }).join(', ');

                            const createSQL = `CREATE TABLE \`${tableName}\` (${columns})`;
                            dbSchema[tableName] = createSQL;
                            console.log(`MySQL Plugin: Schema generated for '${tableName}': ${createSQL}`);
                        } else {
                            console.warn(`MySQL Plugin: Cannot generate schema for empty table '${tableName}'`);
                        }
                    } catch (e) {
                        console.error(`MySQL Plugin: Failed to generate schema for '${tableName}':`, e);
                    }
                }

                snapshot.databases[dbName] = {
                    tables: dbData,
                    schema: dbSchema
                };

                console.log(`MySQL Plugin: Snapshot created for '${dbName}' - ${Object.keys(dbData).length} tables, ${Object.keys(dbSchema).length} schemas`);
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
        console.log('MySQL Plugin: Data structure:', {
            hasData: !!data,
            hasDatabases: !!data?.databases,
            databaseNames: data?.databases ? Object.keys(data.databases) : []
        });

        if (!data?.databases) {
            console.log('MySQL Plugin: No databases found in saved data');
            return;
        }

        try {
            const activeDB = data.activeDatabase || data.currentDB || 'dbo';
            let restoredTablesCount = 0;

            for (const [dbName, content] of Object.entries(data.databases)) {
                const db = content as DatabaseContent;

                console.log(`MySQL Plugin: Processing database '${dbName}'`, {
                    hasTables: !!db.tables,
                    hasSchema: !!db.schema,
                    tableCount: db.tables ? Object.keys(db.tables).length : 0,
                    schemaCount: db.schema ? Object.keys(db.schema).length : 0
                });

                if (!db.tables && !db.schema) {
                    console.warn(`MySQL Plugin: Skipping empty database '${dbName}'`);
                    continue;
                }

                // Ensure database exists
                if (!alasql.databases[dbName]) {
                    await alasql.promise(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
                    console.log(`MySQL Plugin: Created database '${dbName}'`);
                }
                await alasql.promise(`USE ${dbName}`);

                // Restore schemas with validation
                if (db.schema && Object.keys(db.schema).length > 0) {
                    for (const [tableName, sql] of Object.entries(db.schema)) {
                        try {
                            await alasql.promise(`DROP TABLE IF EXISTS ${tableName}`);
                            await alasql.promise(String(sql));

                            // Verify table was created
                            const verifyTable = await alasql.promise(`SHOW TABLES LIKE '${tableName}'`) as any[];
                            if (verifyTable.length > 0) {
                                console.log(`MySQL Plugin: ✓ Schema restored for '${tableName}'`);
                                restoredTablesCount++;
                            } else {
                                console.error(`MySQL Plugin: ✗ Schema failed for '${tableName}' - table not found after creation`);
                            }
                        } catch (e) {
                            console.error(`MySQL Plugin: Error restoring schema for '${tableName}':`, e);
                        }
                    }
                } else {
                    console.warn(`MySQL Plugin: No schemas found for database '${dbName}', will use fallback creation`);
                }

                // Load data in batches with validation
                if (db.tables) {
                    for (const [tableName, rows] of Object.entries(db.tables)) {
                        if (!rows || rows.length === 0) {
                            console.log(`MySQL Plugin: Skipping empty table '${tableName}'`);
                            continue;
                        }

                        try {
                            // Check if table exists before inserting
                            const exists = await alasql.promise(`SHOW TABLES LIKE '${tableName}'`) as any[];

                            if (exists.length === 0) {
                                // Schema didn't create it, use fallback creation
                                console.warn(`MySQL Plugin: Table '${tableName}' missing, attempting fallback creation`);

                                const columns = Object.keys(rows[0]);
                                const columnDefs = columns.map(col => {
                                    const value = rows[0][col];
                                    let type = 'VARCHAR';

                                    if (value === null || value === undefined) {
                                        type = 'VARCHAR';
                                    } else if (typeof value === 'number') {
                                        type = Number.isInteger(value) ? 'INT' : 'FLOAT';
                                    } else if (typeof value === 'boolean') {
                                        type = 'BOOLEAN';
                                    } else if (value instanceof Date) {
                                        type = 'DATE';
                                    }

                                    return `\`${col}\` ${type}`;
                                }).join(', ');

                                await alasql.promise(`CREATE TABLE \`${tableName}\` (${columnDefs})`);
                                console.log(`MySQL Plugin: Fallback table created for '${tableName}'`);
                                restoredTablesCount++;
                            }

                            // Insert data in batches
                            const batchSize = 1000;
                            let insertedRows = 0;

                            for (let i = 0; i < rows.length; i += batchSize) {
                                const batch = rows.slice(i, i + batchSize);
                                await alasql.promise(`INSERT INTO ${tableName} SELECT * FROM ?`, [batch]);
                                insertedRows += batch.length;
                            }

                            console.log(`MySQL Plugin: ✓ Loaded ${insertedRows} rows into '${tableName}'`);
                        } catch (e) {
                            console.error(`MySQL Plugin: Error loading data for '${tableName}':`, e);
                        }
                    }
                }
            }

            // Set active database
            if (alasql.databases[activeDB]) {
                await alasql.promise(`USE ${activeDB}`);
                this.plugin.activeDatabase = activeDB;
                console.log(`MySQL Plugin: Active database set to '${activeDB}'`);
            } else {
                const availableDBs = Object.keys(alasql.databases);
                if (availableDBs.length > 0) {
                    const fallbackDB = availableDBs.includes('dbo') ? 'dbo' : availableDBs[0];
                    await alasql.promise(`USE ${fallbackDB}`);
                    this.plugin.activeDatabase = fallbackDB;
                    console.log(`MySQL Plugin: Using fallback database '${fallbackDB}'`);
                }
            }

            // Final verification
            const finalTables = alasql("SHOW TABLES") as any[];
            console.log(`MySQL Plugin: ✓ Database loaded successfully - ${restoredTablesCount} tables restored`);
            console.log(`MySQL Plugin: Current database '${this.plugin.activeDatabase}' has ${finalTables.length} tables`);

            if (finalTables.length === 0 && restoredTablesCount > 0) {
                console.error('MySQL Plugin: WARNING - Tables were restored but current database appears empty!');
            }

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
            } catch (e) {
                console.error(`Failed to drop ${db}:`, e);
            }
        }

        if (!alasql.databases.dbo) {
            alasql('CREATE DATABASE dbo');
        }
        alasql('USE dbo');
        this.plugin.activeDatabase = 'dbo';

        const newData = {
            ...this.plugin.settings,
            activeDatabase: 'dbo',
            databases: {}
        };
        await this.plugin.saveData(newData);

        console.log('MySQL Plugin: Database reset completed');
    }
}