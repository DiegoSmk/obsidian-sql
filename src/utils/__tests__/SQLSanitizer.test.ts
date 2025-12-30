import { describe, it, expect } from 'vitest';
import { SQLSanitizer } from '../SQLSanitizer';

describe('SQLSanitizer', () => {
    describe('clean', () => {
        it('should remove comments', () => {
            const sql = '-- comment\nSELECT * FROM users; /* block \n comment */';
            const cleaned = SQLSanitizer.clean(sql);
            expect(cleaned).toBe('SELECT * FROM users;');
        });

        it('should remove extra whitespace', () => {
            const sql = '  SELECT   * \n FROM users  ';
            expect(SQLSanitizer.clean(sql)).toBe('SELECT   * \n FROM users');
        });
    });

    describe('sanitizeIdentifier', () => {
        it('should remove invalid characters', () => {
            expect(SQLSanitizer.sanitizeIdentifier('user-name!')).toBe('user_name_');
        });

        it('should truncate long names', () => {
            const longName = 'a'.repeat(100);
            expect(SQLSanitizer.sanitizeIdentifier(longName)).toHaveLength(64);
        });
    });

    describe('validateIdentifier', () => {
        it('should return true for valid identifiers', () => {
            expect(SQLSanitizer.validateIdentifier('valid_name')).toBe(true);
            expect(SQLSanitizer.validateIdentifier('valid123')).toBe(true);
            expect(SQLSanitizer.validateIdentifier('_private')).toBe(true);
        });

        it('should return false for invalid characters', () => {
            expect(SQLSanitizer.validateIdentifier('invalid-name')).toBe(false);
            expect(SQLSanitizer.validateIdentifier('drop;table')).toBe(false);
            expect(SQLSanitizer.validateIdentifier('name with spaces')).toBe(false);
            expect(SQLSanitizer.validateIdentifier("'quoted'")).toBe(false);
        });

        it('should return false for empty strings', () => {
            expect(SQLSanitizer.validateIdentifier('')).toBe(false);
        });

        it('should return false for too long strings', () => {
            const longName = 'a'.repeat(65);
            expect(SQLSanitizer.validateIdentifier(longName)).toBe(false);
        });
    });

    describe('escapeValue', () => {
        it('should handle strings with single quotes', () => {
            expect(SQLSanitizer.escapeValue("It's a test")).toBe("'It''s a test'");
        });

        it('should handle numbers', () => {
            expect(SQLSanitizer.escapeValue(123)).toBe('123');
        });

        it('should handle null/undefined', () => {
            expect(SQLSanitizer.escapeValue(null)).toBe('NULL');
            expect(SQLSanitizer.escapeValue(undefined)).toBe('NULL');
        });
    });
});
