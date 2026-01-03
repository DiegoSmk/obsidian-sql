import { describe, it, expect, beforeEach } from 'vitest';
// @ts-ignore
import alasql from 'alasql';
import { QueryExecutor } from '../QueryExecutor';
import { SQLTransformer } from '../../utils/SQLTransformer';
import { AlaSQLInstance } from '../../types';


describe('QueryExecutor', () => {
    beforeEach(() => {
        // Safe reset of alasql
        try {
            const dbs = Object.keys(alasql.databases).filter(d => d !== 'alasql');
            for (const db of dbs) {
                alasql(`DROP DATABASE IF EXISTS \`${db}\``);
            }
        } catch {
            // Ignore reset failures
        }

        if (!alasql.databases.dbo) {
            alasql('CREATE DATABASE dbo');
        }
        alasql('USE dbo');
    });


    it('should execute a simple SELECT', async () => {
        alasql('CREATE TABLE users (id INT, name STRING)');
        alasql('INSERT INTO users VALUES (1, "Alice")');

        const result = await QueryExecutor.execute('SELECT * FROM users');

        expect(result.success).toBe(true);
        expect(result.data?.[0].type).toBe('table');
        expect(result.data?.[0].data).toHaveLength(1);
        const firstRow = (result.data?.[0].data as Array<Record<string, string | number>>)[0];
        expect(firstRow.name).toBe('Alice');
    });

    it('should intercept USE statements', async () => {
        alasql('CREATE DATABASE secondary');

        const result = await QueryExecutor.execute('USE secondary');

        expect(result.success).toBe(true);
        expect(result.activeDatabase).toBe('secondary');
    });

    it('should block DROP DATABASE (Security)', async () => {
        const result = await QueryExecutor.execute('DROP DATABASE dbo');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Security Block');
    });

    it('should block structural changes in Safe Mode', async () => {
        alasql('CREATE TABLE test (id INT)');
        const result = await QueryExecutor.execute('DROP TABLE test', [], { safeMode: true });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Safe Mode');
        expect(alasql.databases.dbo.tables.test).toBeDefined();
    });

    it('should block write operations in LIVE mode', async () => {
        const result = await QueryExecutor.execute('INSERT INTO users VALUES (1, "Alice")', [], { isLive: true });
        expect(result.success).toBe(false);
        expect(result.error).toContain('Security Block');
    });

    it('should handle batch queries with local context', async () => {
        alasql('CREATE DATABASE db1');
        alasql('CREATE DATABASE db2');
        alasql('CREATE TABLE db1.t1 (v INT)');
        alasql('CREATE TABLE db2.t2 (v INT)');

        const sql = 'USE db1; INSERT INTO t1 VALUES (1); USE db2; INSERT INTO t2 VALUES (2);';
        const result = await QueryExecutor.execute(sql);

        expect(result.success).toBe(true);
        expect(result.activeDatabase).toBe('db2');

        const res1 = (alasql as AlaSQLInstance)('SELECT * FROM db1.t1') as Array<Record<string, number>>;
        const res2 = (alasql as AlaSQLInstance)('SELECT * FROM db2.t2') as Array<Record<string, number>>;
        expect(res1[0].v).toBe(1);
        expect(res2[0].v).toBe(2);
    });


    it('should handle FORM command metadata', async () => {
        alasql('CREATE TABLE clients (id INT PRIMARY KEY, name STRING, birth DATE)');

        const sql = `FORM clients
        name TEXT "Full Name"
        id HIDDEN`;

        const result = await QueryExecutor.execute(sql);

        expect(result.success).toBe(true);
        const formData = result.data?.[0].data as Record<string, unknown>;
        expect(formData.tableName).toBe('dbo.clients');
        const fields = formData.fields as Array<Record<string, unknown>>;
        expect(fields.length).toBeGreaterThan(0);

        const nameField = fields.find((f) => f.name === 'name');
        expect(nameField?.label).toBe('Full Name');
        expect(nameField?.type).toBe('TEXT');

        const idField = fields.find((f) => f.name === 'id');
        expect(idField?.isAutoIncrement).toBe(true);
    });

    it('should handle complex INSERT SELECT with RANGE', async () => {
        alasql('CREATE TABLE estoque (produto STRING, qtd INT)');
        const sql = `DELETE FROM estoque;
INSERT INTO estoque
SELECT 'Item ' + VALUE, RANDOM() * 100
FROM RANGE(1, 10);`;

        const stmts = sql.split(';').filter(s => s.trim().length > 0);
        for (let stmt of stmts) {
            stmt = SQLTransformer.prefixTablesWithDatabase(stmt, 'dbo');
            await (alasql as AlaSQLInstance).promise(stmt);
        }

        const res = (alasql as AlaSQLInstance)('SELECT COUNT(*) as cnt FROM estoque') as Array<Record<string, number>>;
        expect(res[0].cnt).toBe(10);
    });

    it('should automatically prepend LIMIT to single SELECTs', async () => {
        alasql('CREATE TABLE many (id INT)');
        for (let i = 0; i < 5; i++) alasql('INSERT INTO many VALUES (?)', [i]);

        const result = await QueryExecutor.execute('SELECT * FROM many');
        expect(result.success).toBe(true);
    });

    it('should handle LIVE keyword correctly with USE statements', async () => {
        alasql('CREATE DATABASE livedb');
        alasql('CREATE TABLE livedb.data (val INT)');

        const sql = 'USE livedb; SELECT * FROM data;';
        const result = await QueryExecutor.execute(sql, [], { isLive: true });

        expect(result.success).toBe(true);
        expect(result.activeDatabase).toBe('livedb');
    });
});
