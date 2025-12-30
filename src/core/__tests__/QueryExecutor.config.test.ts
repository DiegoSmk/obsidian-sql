import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryExecutor } from '../QueryExecutor';
import { Logger } from '../../utils/Logger';
// @ts-ignore
import alasql from 'alasql';

describe('QueryExecutor Configuration & Logging', () => {
    let consoleSpy: any;

    beforeEach(() => {
        // Reset AlaSQL safely
        try {
            alasql('DROP DATABASE IF EXISTS test_config');
        } catch (e) { }
        alasql('CREATE DATABASE test_config');
        alasql('USE test_config');
        alasql('CREATE TABLE IF NOT EXISTS test (a INT)');

        // Spy on console
        consoleSpy = {
            log: vi.spyOn(console, 'log').mockImplementation(() => { }),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => { }),
            error: vi.spyOn(console, 'error').mockImplementation(() => { })
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should NOT log INFO messages when Logger is disabled (Debug Off)', async () => {
        Logger.setEnabled(false);

        await QueryExecutor.execute('SELECT * FROM test', [], { activeDatabase: 'test_config' });

        // Logger.info calls console.log
        expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should log INFO messages when Logger is enabled (Debug On)', async () => {
        Logger.setEnabled(true);

        await QueryExecutor.execute('SELECT * FROM test', [], { activeDatabase: 'test_config' });

        expect(consoleSpy.log).toHaveBeenCalledWith(
            expect.stringContaining('[MySQL Plugin] Query executed'),
            expect.objectContaining({ executionTime: expect.any(Number) })
        );
    });

    it('should log ERROR messages when query fails, regardless of debug setting', async () => {
        Logger.setEnabled(false); // Even when disabled

        const res = await QueryExecutor.execute('SELECT * FROM non_existent_table', [], { activeDatabase: 'test_config' });

        expect(consoleSpy.error).toHaveBeenCalled();
        expect(res.success).toBe(false);
    });
});
