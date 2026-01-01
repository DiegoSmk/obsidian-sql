import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryExecutor } from '../QueryExecutor';
import { Logger } from '../../utils/Logger';
// @ts-ignore
import alasql from 'alasql';

describe('QueryExecutor Configuration & Logging', () => {
    let consoleSpy: unknown;

    beforeEach(() => {
        // Reset AlaSQL safely
        try {
            alasql('DROP DATABASE IF EXISTS test_config');
        } catch {
            // Ignore if database doesn't exist
        }
        alasql('CREATE DATABASE test_config');
        alasql('USE test_config');
        alasql('CREATE TABLE IF NOT EXISTS test (a INT)');

        // Spy on console
        consoleSpy = {
            debug: vi.spyOn(console, 'debug').mockImplementation(() => { }),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => { }),
            error: vi.spyOn(console, 'error').mockImplementation(() => { })
        } as { debug: unknown, warn: unknown, error: unknown };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should NOT log INFO messages when Logger is disabled (Debug Off)', async () => {
        Logger.setEnabled(false);

        await QueryExecutor.execute('SELECT * FROM test', [], { activeDatabase: 'test_config' });

        // Logger.info calls console.debug
        expect(consoleSpy.debug).not.toHaveBeenCalled();
    });

    it('should log INFO messages when Logger is enabled (Debug On)', async () => {
        Logger.setEnabled(true);

        await QueryExecutor.execute('SELECT * FROM test', [], { activeDatabase: 'test_config' });

        expect(consoleSpy.debug).toHaveBeenCalledWith(
            expect.stringContaining('[MySQL Plugin] Query executed'),
            expect.objectContaining({ executionTime: expect.any(Number) as number })
        );
    });

    it('should log ERROR messages when query fails, regardless of debug setting', async () => {
        Logger.setEnabled(false); // Even when disabled

        const res = await QueryExecutor.execute('SELECT * FROM non_existent_table', [], { activeDatabase: 'test_config' });

        expect(consoleSpy.error).toHaveBeenCalled();
        expect(res.success).toBe(false);
    });
});
