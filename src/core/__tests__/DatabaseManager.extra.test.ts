import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
// @ts-ignore
import alasql from 'alasql';
import { DatabaseManager } from '../DatabaseManager';

describe('DatabaseManager Extra Coverage', () => {
    let mockPlugin: any;
    let dbManager: DatabaseManager;

    beforeEach(async () => {
        // Reset AlaSQL databases
        try {
            const dbs = Object.keys(alasql.databases).filter(d => d !== 'alasql');
            for (const db of dbs) {
                alasql(`DROP DATABASE IF EXISTS \`${db}\``);
            }
        } catch (e) { console.error(e); }

        mockPlugin = {
            settings: { snapshotRowLimit: 1000 },
            saveData: vi.fn().mockResolvedValue(true),
            loadData: vi.fn(),
            activeDatabase: 'dbo'
        };

        dbManager = new DatabaseManager(mockPlugin as any);

        if (!alasql.databases.dbo) {
            alasql('CREATE DATABASE dbo');
        }
        alasql('USE dbo');
    });

    describe('Persistence (Load/Save)', () => {
        it('should save snapshot correctly', async () => {
            alasql('CREATE TABLE test_save (id INT)');
            alasql('INSERT INTO test_save VALUES (1)');

            // Mock loadData to return previous state (empty or existing)
            mockPlugin.loadData.mockResolvedValue({});

            await dbManager.save();

            expect(mockPlugin.saveData).toHaveBeenCalledTimes(2); // Temp + Final
            const saveDataCall = (mockPlugin.saveData.mock.calls[1] as any[])[0];
            expect(saveDataCall.databases.dbo).toBeDefined();
            expect(saveDataCall.databases.dbo.tables.test_save).toHaveLength(1);
        });

        it('should load snapshot correctly', async () => {
            // Setup mock data to load
            const mockData = {
                activeDatabase: 'restored_db',
                databases: {
                    restored_db: {
                        lastUpdated: Date.now(),
                        tables: {
                            users: [{ id: 1, name: 'Test' }]
                        },
                        schema: {
                            users: 'CREATE TABLE users (id INT, name STRING)'
                        }
                    }
                }
            };
            mockPlugin.loadData.mockResolvedValue(mockData);

            await dbManager.load();

            expect(alasql.databases.restored_db).toBeDefined();
            const res = alasql('SELECT * FROM restored_db.users');
            expect(res).toHaveLength(1);
            expect(res[0].name).toBe('Test');
            expect(mockPlugin.activeDatabase).toBe('restored_db');
        });

        it('should handle corrupted schema gracefully during load', async () => {
            const mockData = {
                databases: {
                    corrupted_db: {
                        tables: {
                            bad_table: [{ id: 1 }]
                        },
                        schema: {
                            bad_table: 'INVALID SQL STATEMENT'
                        }
                    }
                }
            };
            mockPlugin.loadData.mockResolvedValue(mockData);
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await dbManager.load();

            // Should have survived the error
            expect(alasql.databases.corrupted_db).toBeDefined();
            // Data loading might also fail if strict INSERT depends on schema, 
            // but the manager tries fallback SELECT INTO if schema-based insert fails/is skipped?
            // Actually implementation checks boolean "hasSchema". If schema provided but invalid, 
            // the CREATE table fails. Then later checks `exists`.
            // If create failed, table won't exist. So data load shouldn't happen.
            expect(consoleSpy).toHaveBeenCalled();

            const tables = alasql('SHOW TABLES FROM corrupted_db') as any[];
            // Expect table NOT to exist because CREATE failed and we don't infer schema if explicit schema string was present but failed?
            // Let's verify implementation: if(db.schema) loop tries to create. Catch logs error.
            // THEN data loop: checks if table exists. 
            // So improper schema => table doesn't exist => data skipped. Correct.
            expect(tables.find((t: any) => t.tableid === 'bad_table')).toBeUndefined();

            consoleSpy.mockRestore();
        });
    });

    describe('Edge Cases', () => {
        it('should fail to rename if source does not exist', async () => {
            await expect(dbManager.renameDatabase('phantom_db', 'new_phantom'))
                .rejects.toThrow(); // The implementation might throw "Table/DB not found" from AlaSQL or custom error
        });

        it('should fail to rename if target already exists', async () => {
            alasql('CREATE DATABASE target_exists');
            alasql('CREATE DATABASE source_db');
            await expect(dbManager.renameDatabase('source_db', 'target_exists'))
                .rejects.toThrow(/already exists/);
        });

        it('should fail to duplicate if target already exists', async () => {
            alasql('CREATE DATABASE target_exists');
            alasql('CREATE DATABASE source_db');
            await expect(dbManager.duplicateDatabase('source_db', 'target_exists'))
                .rejects.toThrow(/already exists/);
        });
    });
});
