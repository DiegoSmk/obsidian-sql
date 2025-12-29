export class Logger {
    private static logs: { level: string, msg: string, data?: any, time: number }[] = [];
    private static MAX_LOGS = 100;

    static log(level: 'INFO' | 'WARN' | 'ERROR', msg: string, data?: any) {
        const entry = { level, msg, data, time: Date.now() };
        this.logs.unshift(entry);
        if (this.logs.length > this.MAX_LOGS) this.logs.pop();

        const consoleMsg = `[MySQL Plugin] ${msg}`;
        if (level === 'ERROR') console.error(consoleMsg, data);
        else if (level === 'WARN') console.warn(consoleMsg, data);
        else console.log(consoleMsg, data);
    }

    static info(msg: string, data?: any) { this.log('INFO', msg, data); }
    static warn(msg: string, data?: any) { this.log('WARN', msg, data); }
    static error(msg: string, data?: any) { this.log('ERROR', msg, data); }

    static getLogs() { return this.logs; }
}
