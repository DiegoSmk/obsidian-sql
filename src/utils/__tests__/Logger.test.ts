import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Logger } from '../Logger';

describe('Logger', () => {
    let consoleSpy: unknown;

    beforeEach(() => {
        // Reset internal state if possible or assume isolation. 
        // Actually Logger has static state. We might need to handle that or just test basic flows.
        // It has static logs array.

        // Mock console
        consoleSpy = {
            debug: vi.spyOn(console, 'debug').mockImplementation(() => { }),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => { }),
            error: vi.spyOn(console, 'error').mockImplementation(() => { })
        };

        Logger.setEnabled(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should log INFO messages only if enabled', () => {
        Logger.info('test info');
        expect(consoleSpy.debug).not.toHaveBeenCalled();

        Logger.setEnabled(true);
        Logger.info('test info 2');
        expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('[MySQL Plugin] test info 2'), undefined);
    });

    it('should log WARN messages regardless of enabled state', () => {
        Logger.warn('test warn');
        expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('[MySQL Plugin] test warn'), undefined);
    });

    it('should log ERROR messages regardless of enabled state', () => {
        Logger.error('test error', { detail: 'foo' });
        expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('[MySQL Plugin] test error'), { detail: 'foo' });
    });

    it('should maintain a log history buffer', () => {
        // Fill buffer
        for (let i = 0; i < 105; i++) {
            Logger.info(`msg ${i}`);
        }

        const logs = Logger.getLogs();
        expect(logs).toHaveLength(100); // Max limit is 100
        expect(logs[0].msg).toBe('msg 104'); // Newest first
    });

    it('should handle data object in logs', () => {
        Logger.setEnabled(true);
        Logger.info('msg with data', { foo: 'bar' });
        expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('msg with data'), { foo: 'bar' });

        Logger.info('msg without data');
        expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('msg without data'), undefined);
    });
});
