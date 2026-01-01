import { describe, it, expect, beforeEach, vi } from 'vitest';
// @ts-ignore
import alasql from 'alasql';
import { DatabaseManager } from '../DatabaseManager';
import { IMySQLPlugin, AlaSQLInstance } from '../../types';

describe('DatabaseManager Extra Coverage', () => {
    let mockPlugin: IMySQLPlugin;
    let dbManager: DatabaseManager;

    beforeEach(async () => {
        // Reset AlaSQL databases
        try {
            const dbs = Object.keys((alasql as unknown as AlaSQLInstance).databases).filter(d => d !== 'alasql');
            for (const db of dbs) {
                alasql(`DROP DATABASE IF EXISTS \`${db}\``);
            }
        } catch {
            // Ignore reset failures
        }

        mockPlugin = {
            settings: { snapshotRowLimit: 1 },
            saveData: vi.fn().mockResolvedValue(true),
            loadData: vi.fn(),
            activeDatabase: 'dbo'
        } as unknown as IMySQLPlugin;

        dbManager = new DatabaseManager(mockPlugin);

        if (!(alasql as AlaSQLInstance).databases.dbo) {
            alasql('CREATE DATABASE dbo');
        }
        alasql('USE dbo');
    });

    describe('Persistence (Load/Save)', () => {
        it('should save snapshot correctly', async () => {
            alasql('CREATE TABLE test_save (id INT)');
            alasql('INSERT INTO test_save VALUES (1)');

            vi.spyOn(mockPlugin, 'loadData').mockResolvedValue({});
            const saveDataMock = vi.spyOn(mockPlugin, 'saveData').mockResolvedValue();

            await dbManager.save();

            expect(saveDataMock).toHaveBeenCalledTimes(1);
            const saveDataCall = saveDataMock.mock.calls[0][0] as { databases: Record<string, { tables: Record<string, unknown[]> }> };
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
            vi.spyOn(mockPlugin, 'loadData').mockResolvedValue(mockData);

            await dbManager.load();

            expect((alasql as AlaSQLInstance).databases.restored_db).toBeDefined();
            const res = (alasql as AlaSQLInstance)('SELECT * FROM restored_db.users') as unknown[];
            expect(res).toHaveLength(1);
            expect((res[0] as Record<string, unknown>).name).toBe('Test');
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
            vi.spyOn(mockPlugin, 'loadData').mockResolvedValue(mockData);
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await dbManager.load();

            // Should have survived the error
            expect((alasql as AlaSQLInstance).databases.corrupted_db).toBeDefined();

            expect(consoleSpy).toHaveBeenCalled();

            const tables = (alasql as AlaSQLInstance)('SHOW TABLES FROM corrupted_db') as Array<{ tableid: string }>;

            expect(tables.find(t => t.tableid === 'bad_table')).toBeUndefined();

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
