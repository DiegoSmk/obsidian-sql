export class PerformanceMonitor {
    private startTime: number = 0;

    start(): void {
        this.startTime = performance.now();
    }

    end(): number {
        return Math.round(performance.now() - this.startTime);
    }
}
