import { describe, it, expect, beforeEach, vi } from 'vitest';
// @ts-ignore
import alasql from 'alasql';
import { DatabaseManager } from '../DatabaseManager';

describe('DatabaseManager', () => {
    let mockPlugin: unknown;
    let dbManager: DatabaseManager;

    beforeEach(async () => {
        // Safe reset of alasql
        try {
            const dbs = Object.keys(alasql.databases).filter(d => d !== 'alasql');
            for (const db of dbs) {
                alasql(`DROP DATABASE IF EXISTS \`${db}\``);
            }
        } catch {
            // Ignore if reset fails
        }

        mockPlugin = {
            settings: { snapshotRowLimit: 100 },
            saveData: vi.fn().mockResolvedValue(true),
            loadData: vi.fn().mockResolvedValue({}),
            activeDatabase: 'dbo'
        };

        dbManager = new DatabaseManager(mockPlugin);

        // Ensure dbo exists and is active
        if (!alasql.databases.dbo) {
            alasql('CREATE DATABASE dbo');
        }
        alasql('USE dbo');
    });



    it('should create a snapshot of existing tables', async () => {
        // Setup data
        alasql('CREATE TABLE test_table (id INT, name STRING)');
        alasql('INSERT INTO test_table VALUES (1, "Alice"), (2, "Bob")');

        // @ts-ignore
        const snapshot = await dbManager.createSnapshot();

        expect(snapshot.databases.dbo).toBeDefined();
        expect(snapshot.databases.dbo.tables.test_table).toHaveLength(2);
        expect((snapshot.databases.dbo.tables.test_table[0]).name).toBe('Alice');
        expect(snapshot.databases.dbo.schema.test_table).toContain('CREATE TABLE `test_table`');
    });

    it('should respect snapshotRowLimit', async () => {
        (mockPlugin as { settings: { snapshotRowLimit: number } }).settings.snapshotRowLimit = 1;

        alasql('CREATE TABLE test_limit (id INT)');
        alasql('INSERT INTO test_limit VALUES (1), (2), (3)');

        // @ts-ignore
        const snapshot = await dbManager.createSnapshot();
        expect(snapshot.databases.dbo.tables.test_limit).toHaveLength(1);
    });

    it('should reset properly', async () => {
        alasql('CREATE DATABASE other_db');
        alasql('CREATE TABLE dbo.test (id INT)');

        await dbManager.reset();

        expect(alasql.databases.other_db).toBeUndefined();
        expect(alasql.databases.dbo).toBeDefined();
        expect(Object.keys(alasql.databases.dbo.tables)).toHaveLength(0);
        expect(mockPlugin.activeDatabase).toBe('dbo');
    });

    it('should delete a database', async () => {
        alasql('CREATE DATABASE to_delete');
        await dbManager.deleteDatabase('to_delete');
        expect(alasql.databases.to_delete).toBeUndefined();
    });

    it('should clear a database', async () => {
        alasql('CREATE TABLE dbo.t1 (a INT)');
        alasql('INSERT INTO dbo.t1 VALUES (1)');

        await dbManager.clearDatabase('dbo');

        expect(Object.keys(alasql.databases.dbo.tables)).toHaveLength(0);
        expect(mockPlugin.saveData).toHaveBeenCalled();
    });

    it('should duplicate a database', async () => {
        alasql('CREATE TABLE dbo.source (v INT)');
        alasql('INSERT INTO dbo.source VALUES (42)');

        await dbManager.duplicateDatabase('dbo', 'dbo_copy');

        expect(alasql.databases.dbo_copy).toBeDefined();
        const res = (alasql('SELECT * FROM [dbo_copy].[source]'));
        expect((res[0] as unknown).v).toBe(42);
    });


    it('should rename a database', async () => {
        alasql('CREATE DATABASE old_name');
        alasql('CREATE TABLE old_name.t1 (v INT)');
        alasql('INSERT INTO old_name.t1 VALUES (10)');

        await dbManager.renameDatabase('old_name', 'new_name');

        expect(alasql.databases.old_name).toBeUndefined();
        expect(alasql.databases.new_name).toBeDefined();
        const res = (alasql('SELECT * FROM [new_name].[t1]'));
        expect((res[0] as unknown).v).toBe(10);
    });


    it('should prevent renaming active database', async () => {
        alasql('CREATE DATABASE some_db');
        mockPlugin.activeDatabase = 'some_db';
        await expect(dbManager.renameDatabase('some_db', 'something_else'))
            .rejects.toThrow(/Cannot rename active database/);
    });

});
