import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseEventBus } from '../DatabaseEventBus';

describe('DatabaseEventBus', () => {
    // Reset instance if possible, but singleton makes it hard without direct access or loose typing.
    // However, since it extends Events, we can just test the public API on the singleton.

    it('should be a singleton', () => {
        const instance1 = DatabaseEventBus.getInstance();
        const instance2 = DatabaseEventBus.getInstance();
        expect(instance1).toBe(instance2);
    });

    it('should emit and receive database modified events', () => {
        const bus = DatabaseEventBus.getInstance();
        const callback = vi.fn();

        bus.onDatabaseModified(callback);

        const eventData = {
            database: 'test_db',
            tables: ['users'],
            timestamp: 123456789,
            originId: 'test_origin'
        };

        bus.emitDatabaseModified(eventData);

        expect(callback).toHaveBeenCalledWith(eventData);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple listeners', () => {
        const bus = DatabaseEventBus.getInstance();
        const cb1 = vi.fn();
        const cb2 = vi.fn();

        bus.onDatabaseModified(cb1);
        bus.onDatabaseModified(cb2);

        bus.emitDatabaseModified({
            database: 'db2',
            tables: [],
            timestamp: 0,
            originId: 'multi'
        });

        expect(cb1).toHaveBeenCalled();
        expect(cb2).toHaveBeenCalled();
    });
});
