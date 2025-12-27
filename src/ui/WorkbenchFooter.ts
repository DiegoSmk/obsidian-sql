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
        logo.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 12C20 14.2091 16.4183 16 12 16C7.58172 16 4 14.2091 4 12M20 12V18C20 20.2091 16.4183 22 12 22C7.58172 22 4 20.2091 4 18V12M20 12C20 9.79086 16.4183 8 12 8C7.58172 8 4 9.79086 4 12M20 6C20 8.20914 16.4183 10 12 10C7.58172 10 4 8.20914 4 6C4 3.79086 7.58172 2 12 2C16.4183 2 20 3.79086 20 6Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
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
