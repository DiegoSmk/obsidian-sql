import { setIcon, App } from "obsidian";
import { HelpModal } from "./HelpModal";

export class WorkbenchFooter {
    private footerEl: HTMLElement;
    private statusEl: HTMLElement;
    private rightEl: HTMLElement;
    private app: App;

    constructor(parent: HTMLElement, app: App) {
        this.app = app;
        this.footerEl = parent.createDiv({ cls: "mysql-footer" });

        // Left: Logo & App Name
        const left = this.footerEl.createDiv({ cls: "mysql-footer-left" });

        const logo = left.createDiv({ cls: "mysql-footer-logo" });
        setIcon(logo, "circle");

        left.createSpan({ text: "SQL Notebook", cls: "mysql-app-name" });

        // Right side container
        this.rightEl = this.footerEl.createDiv({ cls: "mysql-footer-right" });

        // Help Button
        const helpBtn = this.rightEl.createDiv({
            cls: "mysql-footer-help-btn",
            attr: { "aria-label": "Help & Features" }
        });
        setIcon(helpBtn, "help-circle");
        helpBtn.onclick = () => {
            new HelpModal(this.app).open();
        };

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
        this.statusEl.empty();

        const timeWrapper = this.statusEl.createDiv({ cls: "mysql-footer-time-wrapper" });
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
        return this.footerEl;
    }

    public getContainer(): HTMLElement {
        return this.footerEl;
    }
}
