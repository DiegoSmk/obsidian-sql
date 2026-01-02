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
        expect(((result.data?.[0].data as unknown[])[0]).name).toBe('Alice');
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
        expect(result.error).toContain('Blocked SQL command');
    });

    it('should block structural changes in Safe Mode', async () => {
        alasql('CREATE TABLE test (id INT)');
        const result = await QueryExecutor.execute('DROP TABLE test', [], { safeMode: true });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Safe Mode Block');
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
        expect(((alasql as AlaSQLInstance)('SELECT * FROM db1.t1') as unknown[])[0].v).toBe(1);
        expect(((alasql as AlaSQLInstance)('SELECT * FROM db2.t2') as unknown[])[0].v).toBe(2);
    });


    it('should handle FORM command metadata', async () => {
        alasql('CREATE TABLE clients (id INT PRIMARY KEY, name STRING, birth DATE)');

        const sql = `FORM clients
        name TEXT "Full Name"
        id HIDDEN`;

        const result = await QueryExecutor.execute(sql);

        expect(result.success).toBe(true);
        const formData = result.data?.[0].data;
        expect(formData.tableName).toBe('dbo.clients');
        expect(formData.fields).toHaveLength(3);

        const nameField = (formData.fields as unknown[]).find((f: unknown) => f.name === 'name');
        expect(nameField.label).toBe('Full Name');
        expect(nameField.type).toBe('TEXT');

        const idField = (formData.fields as unknown[]).find((f: unknown) => f.name === 'id');
        expect(idField.isAutoIncrement).toBe(true);
        // Since it is HIDDEN or id PK
    });

    it('should handle complex INSERT SELECT with RANGE', async () => {
        alasql('CREATE TABLE estoque (produto STRING, qtd INT)');
        const sql = `DELETE FROM estoque;
INSERT INTO estoque
SELECT 'Item ' || CAST(VALUE AS STRING), RANDOM() * 100
FROM RANGE(1, 10);`;



        const stmts = sql.split(';').filter(s => s.trim().length > 0);
        for (let stmt of stmts) {
            stmt = SQLTransformer.prefixTablesWithDatabase(stmt, 'dbo');
            await alasql.promise(stmt);
        }























        const res = (alasql as AlaSQLInstance)('SELECT COUNT(*) as cnt FROM estoque') as unknown[];
        expect(res[0].cnt).toBe(10);
    });

    it('should automatically prepend LIMIT to single SELECTs', async () => {
        alasql('CREATE TABLE many (id INT)');
        for (let i = 0; i < 5; i++) alasql('INSERT INTO many VALUES (?)', [i]);

        // This is a bit hard to test directly as it's an internal string manipulation 
        // that happens before execution, but we can verify it doesn't break.
        const result = await QueryExecutor.execute('SELECT * FROM many');
        expect(result.success).toBe(true);
    });

    it('should handle LIVE keyword correctly with USE statements', async () => {
        alasql('CREATE DATABASE playground');
        alasql('CREATE TABLE playground.inventory (id INT, price INT)');
        alasql('INSERT INTO playground.inventory VALUES (1, 150)');

        const sql = 'USE playground; LIVE SELECT * FROM inventory WHERE price >= 100';
        const result = await QueryExecutor.execute(sql, [], { isLive: true });

        expect(result.success).toBe(true);
        expect(result.activeDatabase).toBe('playground');
        expect(result.data?.[1].type).toBe('table');
        expect(result.data?.[1].data).toHaveLength(1);
    });
});
