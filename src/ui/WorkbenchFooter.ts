import { setIcon, App } from "obsidian";
import { HelpModal } from "./HelpModal";
import { ProPracticeModal } from "./ProPracticeModal";
import { t } from "../utils/i18n";

export class WorkbenchFooter {
    private footerEl: HTMLElement;
    private statusEl: HTMLElement;
    private dbEl: HTMLElement;
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

        // Phase 6: Active Database on the right
        this.dbEl = this.rightEl.createDiv({ cls: "mysql-footer-db-container mysql-footer-db-interactive" });
        this.dbEl.onclick = () => {
            new ProPracticeModal(this.app).open();
        };
        this.setActiveDatabase("dbo");

        // Help Button (?)
        const helpBtn = this.rightEl.createDiv({
            cls: "mysql-footer-help-btn",
            attr: { "aria-label": t('footer.tip_help') }
        });
        setIcon(helpBtn, "help-circle");
        helpBtn.onclick = () => {
            new HelpModal(this.app).open();
        };

        // Status (Ready, Time)
        this.statusEl = this.rightEl.createDiv({ cls: "mysql-footer-status-container" });
        this.setStatus(t('footer.status_ready'));
    }

    public setStatus(text: string, isRunning: boolean = false) {
        this.statusEl.empty();
        const status = this.statusEl.createSpan({
            text: text,
            cls: isRunning ? "mysql-footer-status-running" : "mysql-footer-status"
        });
    }

    public updateTime(ms: number) {
        this.statusEl.empty();
        const timeWrapper = this.statusEl.createDiv({ cls: "mysql-footer-time-wrapper" });
        setIcon(timeWrapper, "timer");
        const timeVal = timeWrapper.createSpan({ cls: "mysql-footer-time-val" });
        timeVal.setText(`${ms}ms`);
    }

    public setActiveDatabase(dbName: string) {
        this.dbEl.empty();
        const iconWrapper = this.dbEl.createDiv({ cls: "mysql-footer-db-icon" });
        setIcon(iconWrapper, "database-backup");
        this.dbEl.createSpan({ text: dbName, cls: "mysql-footer-db-name" });
    }

    public setLive() {
        this.statusEl.empty();
        const indicator = this.statusEl.createDiv({ cls: "mysql-live-indicator" });
        indicator.createDiv({ cls: "mysql-pulse-dot" });
        indicator.createSpan({ text: t('footer.status_live') });
    }

    public setError() {
        this.setStatus(t('footer.status_error'));
    }

    public setAborted() {
        this.setStatus(t('footer.status_aborted'));
    }

    public getContainer(): HTMLElement {
        return this.footerEl;
    }
}
