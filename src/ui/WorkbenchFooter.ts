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
    private statusSpan: HTMLElement;
    private timeEl: HTMLElement;

    constructor(parent: HTMLElement, app: App) {
        this.app = app;
        this.footerEl = parent.createDiv({ cls: "mysql-footer" });

        // Left: Logo & App Name
        const left = this.footerEl.createDiv({ cls: "mysql-footer-left" });
        const logo = left.createDiv({ cls: "mysql-footer-logo" });
        setIcon(logo, "circle");
        left.createSpan({ text: t('common.app_name') || "SQL Notebook", cls: "mysql-app-name" });

        // Right side container
        this.rightEl = this.footerEl.createDiv({ cls: "mysql-footer-right" });

        // Timer Container (Positioned before DB)
        this.timeEl = this.rightEl.createDiv({
            cls: "mysql-footer-time-container mysql-footer-item u-display-none"
        });

        // Phase 6: Active Database on the right
        this.dbEl = this.rightEl.createDiv({ cls: "mysql-footer-db-container mysql-footer-item mysql-footer-interactive" });
        this.dbEl.onclick = () => {
            new ProPracticeModal(this.app).open();
        };
        this.setActiveDatabase("dbo");

        // Help Button
        const helpBtn = this.rightEl.createDiv({
            cls: "mysql-footer-help-btn mysql-footer-item mysql-footer-interactive",
            attr: { "aria-label": t('footer.tip_help') }
        });
        setIcon(helpBtn, "help-circle");
        helpBtn.onclick = () => {
            new HelpModal(this.app).open();
        };

        // Status (Ready, Time)
        this.statusEl = this.rightEl.createDiv({ cls: "mysql-footer-status-container" });
        this.statusSpan = this.statusEl.createSpan({ cls: "mysql-footer-status" });
        this.setStatus(t('footer.status_ready'));
    }

    public setStatus(status: string, spinning: boolean = false) {
        if (!this.statusSpan) return;
        this.statusSpan.setText(status);
        if (spinning) {
            this.statusSpan.addClass('is-spinning');
            this.timeEl.addClass('u-display-none');
        } else {
            this.statusSpan.removeClass('is-spinning');
        }
    }

    public updateTime(ms: number) {
        this.timeEl.empty();
        this.timeEl.removeClass('u-display-none');

        const timeWrapper = this.timeEl.createDiv({ cls: "mysql-footer-time-wrapper" });
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
        this.timeEl.addClass('u-display-none');
        const existingIndicator = this.statusEl.querySelector('.mysql-live-indicator');
        if (existingIndicator) existingIndicator.remove();

        const indicator = this.statusEl.createDiv({ cls: "mysql-live-indicator" });
        indicator.createDiv({ cls: "mysql-pulse-dot" });
        indicator.createSpan({ text: t('footer.status_live') });

        if (this.statusSpan) {
            this.statusEl.appendChild(this.statusSpan);
        }
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
