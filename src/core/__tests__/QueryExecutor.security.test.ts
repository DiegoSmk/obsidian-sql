import { describe, it, expect, vi } from 'vitest';
import { QueryExecutor } from '../QueryExecutor';

// Mock t function since it's used in QueryExecutor
vi.mock('../../utils/i18n', () => ({
    t: (key: string, vars?: Record<string, string>) => `${key}${vars ? JSON.stringify(vars) : ''}`
}));

describe('QueryExecutor Security Refactor', () => {
    it('should block DROP DATABASE dbo always', async () => {
        const query = 'DROP DATABASE dbo';
        const res = await QueryExecutor.execute(query);
        expect(res.success).toBe(false);
        expect(res.error).toContain('executor.err_blocked_command');
        expect(res.error).toContain('DROP DATABASE dbo');
    });

    it('should block DROP DATABASE other_db if safeMode is true', async () => {
        const query = 'DROP DATABASE other_db';
        const res = await QueryExecutor.execute(query, [], { safeMode: true });
        expect(res.success).toBe(false);
        expect(res.error).toContain('executor.err_safe_mode');
    });

    it('should block SHUTDOWN always', async () => {
        const res = await QueryExecutor.execute('SHUTDOWN');
        expect(res.success).toBe(false);
        expect(res.error).toContain('executor.err_blocked_command');
        expect(res.error).toContain('SHUTDOWN');
    });
});
