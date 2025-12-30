import { describe, it, expect } from 'vitest';
import { SQLTransformer } from '../SQLTransformer';

describe('SQLTransformer', () => {
    describe('prefixTablesWithDatabase', () => {
        const db = 'my_db';

        it('should prefix simple SELECT FROM', () => {
            const sql = 'SELECT * FROM users';
            expect(SQLTransformer.prefixTablesWithDatabase(sql, db)).toBe('SELECT * FROM [my_db].[users]');
        });

        it('should prefix INSERT INTO', () => {
            const sql = 'INSERT INTO logs (msg) VALUES ("test")';
            expect(SQLTransformer.prefixTablesWithDatabase(sql, db)).toBe('INSERT INTO [my_db].[logs] (msg) VALUES ("test")');
        });

        it('should NOT prefix functions like RANGE()', () => {
            const sql = 'SELECT * FROM RANGE(1, 10)';
            expect(SQLTransformer.prefixTablesWithDatabase(sql, db)).toBe('SELECT * FROM RANGE(1, 10)');
        });

        it('should NOT prefix if already prefixed', () => {
            const sql = 'SELECT * FROM other_db.items';
            expect(SQLTransformer.prefixTablesWithDatabase(sql, db)).toBe('SELECT * FROM other_db.items');
        });


        it('should prefix JOINs', () => {
            const sql = 'SELECT * FROM users JOIN profiles ON users.id = profiles.user_id';
            const transformed = SQLTransformer.prefixTablesWithDatabase(sql, db);
            expect(transformed).toContain('FROM [my_db].[users]');
            expect(transformed).toContain('JOIN [my_db].[profiles]');
        });

        it('should NOT prefix system keywords in FROM like (SELECT...)', () => {
            const sql = 'SELECT * FROM (SELECT id FROM users)';
            // Note: The inner SELECT will also be processed in a real execution loop, 
            // but the regex itself should ignore the LPAR.
            expect(SQLTransformer.prefixTablesWithDatabase(sql, db)).toContain('FROM (SELECT id FROM [my_db].[users])');
        });

        it('should handle complex AlaSQL data sources like JSON()', () => {
            const sql = 'SELECT * FROM JSON("data.json")';
            expect(SQLTransformer.prefixTablesWithDatabase(sql, db)).toBe('SELECT * FROM JSON("data.json")');
        });

        it('should NOT prefix additional reserved keywords', () => {
            const keywords = ['VALUES', 'EXPLODE', 'CSV', 'TAB', 'TSV', 'XLSX'];
            keywords.forEach(kw => {
                const sql = `SELECT * FROM ${kw}(foo)`;
                expect(SQLTransformer.prefixTablesWithDatabase(sql, db)).toBe(sql);
            });
        });

        it('should prefix tables in DELETE and UPDATE statements', () => {
            const del = 'DELETE FROM users WHERE id=1';
            expect(SQLTransformer.prefixTablesWithDatabase(del, db)).toBe('DELETE FROM [my_db].[users] WHERE id=1');

            const upd = 'UPDATE settings SET val=1';
            expect(SQLTransformer.prefixTablesWithDatabase(upd, db)).toBe('UPDATE [my_db].[settings] SET val=1');
        });

        it('should do nothing if database is alasql or empty', () => {
            expect(SQLTransformer.prefixTablesWithDatabase('SELECT * FROM tbl', '')).toBe('SELECT * FROM tbl');
            expect(SQLTransformer.prefixTablesWithDatabase('SELECT * FROM tbl', 'alasql')).toBe('SELECT * FROM tbl');
        });
    });
});
