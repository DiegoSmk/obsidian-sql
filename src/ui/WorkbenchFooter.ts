import { setIcon } from "obsidian";

export class WorkbenchFooter {
    private footerEl: HTMLElement;
    private statusEl: HTMLElement;
    private rightEl: HTMLElement;

    constructor(parent: HTMLElement) {
        this.footerEl = parent.createDiv({ cls: "mysql-footer" });

        // Left: Logo & App Name
        const left = this.footerEl.createDiv({ cls: "mysql-footer-left" });

        const logo = left.createDiv({ cls: "mysql-footer-logo" });
        logo.innerHTML = `<svg width="18" height="18" viewBox="0 0 184 184" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M92 104C127.346 104 156 95.046 156 84C156 72.954 127.346 64 92 64C56.6538 64 28 72.954 28 84C28 95.046 56.6538 104 92 104Z" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M28 84V156C28 167 57 176 92 176C127 176 156 167 156 156V80" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M28 120C28 131 57 140 92 140C127 140 156 131 156 120" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M28 156C28 167 57 176 92 176C127 176 156 167 156 156" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M92 44C127.346 44 156 35.0457 156 24C156 12.9543 127.346 4 92 4C56.6538 4 28 12.9543 28 24C28 35.0457 56.6538 44 92 44Z" fill="currentColor"/>
<path d="M28 24V60C28 71 57 80 92 80C127 80 156 71 156 60V24" fill="currentColor"/>
<path d="M92 80C127.346 80 156 71.046 156 60C156 48.9543 127.346 40 92 40C56.6538 40 28 48.9543 28 60C28 71.046 56.6538 80 92 80Z" fill="currentColor"/>
</svg>`;

        left.createSpan({ text: "SQL Notebook", cls: "mysql-app-name" });

        // Right side container
        this.rightEl = this.footerEl.createDiv({ cls: "mysql-footer-right" });
        this.statusEl = this.rightEl.createDiv({ cls: "mysql-footer-status-container" });

        this.setStatus("Ready");
    }

    public setStatus(text: string, isRunning: boolean = false) {
        this.statusEl.empty();
        const status = this.statusEl.createSpan({
            text: text,
            cls: isRunning ? "mysql-footer-status-running" : "mysql-footer-status"
        });

        if (isRunning) {
            // Optional: could add a spinner icon here
        }
    }

    public updateTime(ms: number) {
        this.rightEl.empty();

        // Re-add status if needed, or just time
        const timeWrapper = this.rightEl.createDiv({ cls: "mysql-footer-time-wrapper" });
        setIcon(timeWrapper, "timer");
        const timeVal = timeWrapper.createSpan({ cls: "mysql-footer-time-val" });
        timeVal.setText(`${ms}ms`);
    }

    public setError() {
        this.setStatus("Error");
    }

    public setAborted() {
        this.setStatus("Aborted");
    }

    public getStatusEl(): HTMLElement {
        return this.footerEl; // Return main footer for consistency with previous logic if needed
    }

    // Helper to get the element that should be passed to executeQuery
    public getContainer(): HTMLElement {
        return this.footerEl;
    }
}
