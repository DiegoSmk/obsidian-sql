import { Plugin, Notice, debounce, Debouncer, setIcon, Menu, MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';
// @ts-ignore
import alasql from 'alasql';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';

import { MySQLSettings, IMySQLPlugin, IDatabaseManager, IQueryExecutor, AlaSQLInstance } from './types';
import { DEFAULT_SETTINGS } from './utils/constants';
import { SQLSanitizer } from './utils/SQLSanitizer';
import { Logger } from './utils/Logger';

import { DatabaseManager } from './core/DatabaseManager';
import { CSVManager } from './core/CSVManager';
import { QueryExecutor } from './core/QueryExecutor';
import { DatabaseEventBus, DatabaseChangeEvent } from './core/DatabaseEventBus';

import { ResultRenderer } from './ui/ResultRenderer';
import { CSVSelectionModal } from './ui/CSVSelectionModal';
import { MySQLSettingTab } from './settings';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { WorkbenchFooter } from './ui/WorkbenchFooter';
import { setLanguage, t } from './utils/i18n';

/**
 * Component to manage the lifecycle of a LIVE block synchronization listener.
 * This ensures listeners are correctly detached when the block is unloaded.
 */
class LiveSyncComponent extends MarkdownRenderChild {
    constructor(containerEl: HTMLElement, private bus: DatabaseEventBus, private handler: (event: DatabaseChangeEvent) => void) {
        super(containerEl);
    }
    onunload() {
        this.bus.off(DatabaseEventBus.DATABASE_MODIFIED, this.handler);
    }
}

export default class MySQLPlugin extends Plugin implements IMySQLPlugin {
    settings: MySQLSettings;
    public dbManager: IDatabaseManager;
    public csvManager: CSVManager;
    public activeDatabase: string = 'dbo';
    public queryExecutor: IQueryExecutor = QueryExecutor as unknown as IQueryExecutor;
    // @ts-ignore
    private debouncedSave: Debouncer<[], Promise<void>>;

    async onload() {
        await this.loadSettings();

        // Initialize i18n
        setLanguage(this.settings.language);

        // Initialize Logger State
        Logger.setEnabled(this.settings.enableLogging);

        // Apply theme
        this.applyTheme();

        // Initialize alasql
        alasql.options.autocommit = true;
        alasql.options.mysql = true;
        (alasql as AlaSQLInstance).promise = <T>(sql: string, params?: unknown): Promise<T> => {
            return new Promise<T>((resolve, reject) => {
                alasql(sql, params || [], (data: unknown, err: Error) => {
                    if (err) reject(err);
                    else resolve(data as T);
                });
            });
        };

        this.dbManager = new DatabaseManager(this);
        this.csvManager = new CSVManager(this);

        this.debouncedSave = debounce(
            () => this.dbManager.save(),
            this.settings.autoSaveDelay,
            true
        );

        // CRITICAL: restore database before UI or processors
        await this.dbManager.load();

        // Register SQL code block
        this.registerMarkdownCodeBlockProcessor("mysql", (source, el, ctx) => {
            void this.processSQLBlock(source, el, ctx);
        });

        // Add Import CSV command
        this.addCommand({
            id: 'import-csv-to-alasql',
            name: 'Import CSV to table',
            callback: () => {
                new CSVSelectionModal(this.app, (file) => {
                    void (async () => {
                        const success = await this.csvManager.importCSV(file);
                        if (success) {
                            await this.dbManager.save();
                        }
                    })();
                }).open();
            }
        });

        // Add Settings Tab
        this.addSettingTab(new MySQLSettingTab(this.app, this));
    }

    onunload() {
        if (this.settings.autoSave) {
            void this.dbManager.save();
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MySQLSettings>);
        setLanguage(this.settings.language);
    }

    async saveSettings() {
        await this.saveData(this.settings);
        // Update debounce delay if changed
        if (this.debouncedSave) {
            this.debouncedSave = debounce(
                () => this.dbManager.save(),
                this.settings.autoSaveDelay,
                true
            );
        }

        this.applyTheme();
    }

    applyTheme() {
        const settings = this.settings;
        const color = settings.useObsidianAccent ? 'var(--interactive-accent)' : settings.themeColor;

        // Set variables on body for global availability
        (document.body as any).style.setProperty('--mysql-accent', color);
        (document.body as any).style.setProperty('--mysql-accent-purple', color);
    }

    // ========================================================================
    // LOGIC PORTED FROM MONOLITHIC CLASS
    // ========================================================================

    private generateBlockStableId(source: string, ctx: MarkdownPostProcessorContext): string {
        const hash = (str: string) => {
            let h1 = 0x811c9dc5, h2 = 0xdeadbeef;
            for (let i = 0; i < str.length; i++) {
                h1 = Math.imul(h1 ^ str.charCodeAt(i), 16777619);
                h2 = Math.imul(h2 ^ str.charCodeAt(i), 0x5bd1e995);
            }
            return (Math.abs(h1).toString(16) + Math.abs(h2).toString(16)).substring(0, 16);
        };
        // We use path + 16-char hash for stability and collision resistance
        return `${ctx.sourcePath}:${hash(source.trim())}`;
    }

    async processSQLBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
        el.empty();
        el.addClass("mysql-block-parent");
        const workbench = el.createEl("div", { cls: "mysql-workbench-container" });

        // Phase 2: LIVE Mode Detection & Identity
        const trimmedSource = source.trim();
        const isLive = trimmedSource.toUpperCase().startsWith("LIVE SELECT");
        const isForm = trimmedSource.toUpperCase().startsWith("FORM");
        const stableId = (isLive || isForm) ? this.generateBlockStableId(source, ctx) : null;

        if (isLive && this.settings.enableLogging) {
            Logger.info(`[LIVE] Initializing block: stableId=${stableId}`);
        }

        // Resolve Anchored Database (Priority: Params > Settings Cache > Global Active)
        let anchoredDB: string | null = null;
        if (isLive || isForm) {
            const jsonParamMatch = source.match(/\/\*\s*params\s*:\s*({[\s\S]*?})\s*\*\//);
            const lineParamMatch = source.match(/--\s*db:\s*([a-zA-Z_][a-zA-Z0-9_]*)/i);

            if (jsonParamMatch) {
                try {
                    const p = JSON.parse(jsonParamMatch[1]) as Record<string, unknown>;
                    if (p.db) anchoredDB = p.db as string;
                } catch (e) {
                    Logger.debug("Failed to parse JSON params", e);
                }
            }

            if (!anchoredDB && lineParamMatch) {
                anchoredDB = lineParamMatch[1];
            }

            // Check Settings Cache
            if (!anchoredDB && stableId && this.settings.liveBlockAnchors[stableId]) {
                anchoredDB = this.settings.liveBlockAnchors[stableId];
            }

            // Fallback to current global and save as anchor
            if (!anchoredDB) {
                anchoredDB = this.activeDatabase;
                if (stableId) {
                    this.settings.liveBlockAnchors[stableId] = anchoredDB;
                    void this.saveSettings();
                }
            }
        }

        let observedTables: string[] = [];

        if (isLive) {
            workbench.addClass("mysql-live-mode");
            try {
                // Extract SQL without LIVE prefix for AST parsing
                const sqlForAST = trimmedSource.substring(5).trim();
                const extractFromNode = (node: unknown) => {
                    if (!node) return;
                    if (typeof node === 'object' && node !== null && 'tableid' in node) {
                        const tid = (node as { tableid: string }).tableid.toLowerCase();
                        observedTables.push(tid.includes('.') ? tid.split('.').pop() ?? tid : tid);
                    }
                    if (Array.isArray(node)) {
                        node.forEach(extractFromNode);
                    } else if (typeof node === 'object' && node !== null) {
                        Object.values(node as Record<string, unknown>).forEach(val => {
                            if (typeof val === 'object' && val !== null) extractFromNode(val);
                        });
                    }
                };
                const ast = (alasql as { parse: (s: string) => unknown }).parse(sqlForAST);
                extractFromNode(ast);

                observedTables = Array.from(new Set(observedTables));
                Logger.info(`[LIVE] Monitoring tables: `, observedTables);
            } catch (e) {
                Logger.warn("Failed to parse LIVE AST", e);
            }
        }

        // Collapsed Preview (Bar with first line of code)
        const rawFirstLine = source.split('\n')[0].trim();
        let displayTitle = isForm ? "Data Form" : (isLive ? "Live Result" : "SQL Query");
        let icon = isForm ? "file-edit" : (isLive ? "pulse" : "database");
        let titleColorClass = "";
        let startCollapsed = false;

        const isComment = /^(--|#|\/\*)/.test(rawFirstLine);
        if (isComment) {
            let cleanLine = rawFirstLine.replace(/^(--\s?|#\s?|\/\*\s?)/, '').replace(/\s?\*\/$/, '').trim();
            if (cleanLine.includes("@")) {
                startCollapsed = true;
                cleanLine = cleanLine.replace("@", "").trim();
            }
            if (cleanLine.startsWith("!")) {
                icon = "alert-triangle";
                titleColorClass = "mysql-title-alert";
                workbench.addClass("mysql-mode-alert");
                cleanLine = cleanLine.substring(1).trim();
            } else if (cleanLine.startsWith("?")) {
                icon = "help-circle";
                titleColorClass = "mysql-title-help";
                workbench.addClass("mysql-mode-help");
                cleanLine = cleanLine.substring(1).trim();
            } else if (cleanLine.startsWith("*")) {
                icon = "star";
                titleColorClass = "mysql-title-star";
                workbench.addClass("mysql-mode-star");
                cleanLine = cleanLine.substring(1).trim();
            }
            if (cleanLine.length > 0) displayTitle = cleanLine;
        }

        const previewBar = workbench.createEl("div", { cls: "mysql-collapsed-preview" });
        const previewToggle = previewBar.createEl("div", { cls: "mysql-preview-toggle" });
        setIcon(previewToggle, "chevron-right");

        const previewContent = previewBar.createEl("div", { cls: "mysql-preview-content" });
        const iconSpan = previewContent.createSpan({ cls: "mysql-preview-icon" });
        if (titleColorClass) iconSpan.addClass(titleColorClass);
        setIcon(iconSpan, icon);

        const textSpan = previewContent.createSpan({ cls: "mysql-preview-text", text: displayTitle });
        if (titleColorClass && titleColorClass !== "mysql-title-help") textSpan.addClass(titleColorClass);

        const body = workbench.createEl("div", { cls: "mysql-workbench-body" });

        previewBar.onclick = () => {
            workbench.removeClass("is-collapsed");
            body.removeClass("u-display-none");
            previewBar.addClass("u-display-none");
            previewBar.removeClass("u-display-flex");
        };

        const collapseBtn = body.createEl("button", {
            cls: "mysql-collapse-btn",
            attr: { "aria-label": "Collapse" }
        });
        setIcon(collapseBtn, "chevron-up");
        collapseBtn.onclick = (e) => {
            e.stopPropagation();
            workbench.addClass("is-collapsed");
            body.addClass("u-display-none");
            previewBar.removeClass("u-display-none");
            previewBar.addClass("u-display-flex");
        };

        if (startCollapsed) {
            workbench.addClass("is-collapsed");
            previewBar.addClass("u-display-flex");
            body.addClass("u-display-none");
        } else {
            previewBar.addClass("u-display-none");
        }

        const copyCodeBtn = body.createEl("button", {
            cls: "mysql-copy-code-btn",
            attr: { "aria-label": "Copy code" }
        });
        setIcon(copyCodeBtn, "copy");
        copyCodeBtn.onclick = async (e) => {
            e.stopPropagation();
            await navigator.clipboard.writeText(source);
            new Notice(t('workbench.notice_copy') || "Code copied to clipboard");
        };

        const codeBlock = body.createEl("pre", { cls: "mysql-source-code" });
        const code = codeBlock.createEl("code", { cls: "language-sql" });
        this.appendHighlightedCode(code, source);

        const controls = body.createEl("div", { cls: "mysql-controls" });
        const runBtn = controls.createEl("button", { cls: "mysql-btn mysql-btn-run" });
        setIcon(runBtn, "play");
        runBtn.createSpan({ text: t('workbench.btn_run') });

        const rightControls = controls.createEl("div", { cls: "mysql-controls-right" });
        const showTablesBtn = rightControls.createEl("button", { cls: "mysql-btn" });
        setIcon(showTablesBtn, "table");
        showTablesBtn.createSpan({ text: t('modals.btn_tabelas') });

        const importBtn = rightControls.createEl("button", { cls: "mysql-btn" });
        setIcon(importBtn, "file-up");
        importBtn.createSpan({ text: t('settings.btn_importar') });

        const resetBtn = rightControls.createEl("button", { cls: "mysql-btn mysql-btn-danger" });
        setIcon(resetBtn, "trash-2");
        resetBtn.createSpan({ text: t('settings.reset_btn') });

        const resultContainer = body.createEl("div", { cls: "mysql-result-container" });
        const footerInstance = new WorkbenchFooter(body, this.app);
        footerInstance.setActiveDatabase(anchoredDB || this.activeDatabase);

        importBtn.onclick = () => {
            new CSVSelectionModal(this.app, (file) => {
                void (async () => {
                    const success = await this.csvManager.importCSV(file);
                    if (success) {
                        await this.dbManager.save();
                        this.showTables(resultContainer, showTablesBtn);
                    }
                })();
            }).open();
        };

        showTablesBtn.onclick = () => this.showTables(resultContainer, showTablesBtn);
        resetBtn.onclick = () => void this.resetDatabase(resultContainer, footerInstance);

        const paramMatch = source.match(/\/\*\s*params\s*:\s*({[\s\S]*?})\s*\*\//);
        const params: Record<string, unknown> = paramMatch ? (JSON.parse(paramMatch[1]) as Record<string, unknown>) : {};

        if (Object.keys(params).length > 0) {
            this.renderParameterInputs(params, controls, runBtn, (newParams) => {
                void this.executeQuery(source, newParams, runBtn, resultContainer, footerInstance);
            });
        }

        runBtn.onclick = () => void this.executeQuery(source, params, runBtn, resultContainer, footerInstance);

        if (isForm && anchoredDB) {
            workbench.addClass("mysql-form-mode");
            body.addClass("mysql-view-only");
            previewBar.addClass("u-display-none");
            footerInstance.getContainer().addClass("u-display-none");
            codeBlock.addClass("u-display-none");
            controls.addClass("u-display-none");

            const dashboardBar = body.createDiv({ cls: "mysql-live-dashboard-bar mysql-form-dashboard-bar" });
            body.prepend(dashboardBar);

            const dashboardLeft = dashboardBar.createDiv({ cls: "mysql-dashboard-left u-display-flex u-align-center u-gap-md" });
            const formIndicator = dashboardLeft.createDiv({ cls: "mysql-live-indicator mysql-form-indicator" });
            setIcon(formIndicator, "file-edit");
            formIndicator.createSpan({ text: "FORM" });

            const dbInfo = dashboardLeft.createDiv({ cls: "mysql-footer-db-container mysql-live-db-switcher" });
            const dbIcon = dbInfo.createDiv({ cls: "mysql-footer-db-icon" });
            setIcon(dbIcon, "database-backup");
            const dbNameSpan = dbInfo.createSpan({ text: anchoredDB, cls: "mysql-footer-db-name" });

            dbInfo.onclick = (e) => {
                const menu = new Menu();
                const dbs = Object.keys((alasql as { databases: Record<string, unknown> }).databases).filter(d => d !== 'alasql');
                dbs.sort().forEach(db => {
                    menu.addItem((item) => {
                        item.setTitle(db)
                            .setIcon(db === anchoredDB ? "check" : "database")
                            .onClick(async () => {
                                if (db === anchoredDB) return;
                                anchoredDB = db;
                                if (stableId) {
                                    this.settings.liveBlockAnchors[stableId] = db;
                                    await this.saveSettings();
                                }
                                dbNameSpan.setText(db);
                                new Notice(t('common.notice_anchor_form', { name: db }) || `Form anchored to ${db}`);
                                void this.executeQuery(source, params, runBtn, resultContainer, footerInstance, { activeDatabase: anchoredDB });
                            });
                    });
                });
                menu.showAtMouseEvent(e);
            };

            void this.executeQuery(source, params, runBtn, resultContainer, footerInstance, { activeDatabase: anchoredDB });
        }

        if (isLive && stableId && anchoredDB) {
            body.addClass("mysql-view-only");
            previewBar.addClass("u-display-none");
            footerInstance.getContainer().addClass("u-display-none");
            codeBlock.addClass("u-display-none");

            const dashboardBar = body.createDiv({ cls: "mysql-live-dashboard-bar" });
            body.prepend(dashboardBar);

            const dashboardLeft = dashboardBar.createDiv({ cls: "mysql-dashboard-left u-display-flex u-align-center u-gap-md" });
            const liveIndicator = dashboardLeft.createDiv({ cls: "mysql-live-indicator" });
            liveIndicator.createDiv({ cls: "mysql-pulse-dot" });
            liveIndicator.createSpan({ text: "LIVE" });

            const dbInfo = dashboardLeft.createDiv({ cls: "mysql-footer-db-container mysql-live-db-switcher" });
            const dbIcon = dbInfo.createDiv({ cls: "mysql-footer-db-icon" });
            setIcon(dbIcon, "database-backup");
            const dbNameSpan = dbInfo.createSpan({ text: anchoredDB, cls: "mysql-footer-db-name" });

            dbInfo.onclick = (e) => {
                const menu = new Menu();
                const dbs = Object.keys(alasql.databases).filter(d => d !== 'alasql');
                dbs.sort().forEach(db => {
                    menu.addItem((item) => {
                        item.setTitle(db)
                            .setIcon(db === anchoredDB ? "check" : "database")
                            .onClick(async () => {
                                if (db === anchoredDB) return;
                                anchoredDB = db;
                                if (stableId) {
                                    this.settings.liveBlockAnchors[stableId] = db;
                                    await this.saveSettings();
                                }
                                dbNameSpan.setText(db);
                                new Notice(t('common.notice_anchor_live', { name: db }) || `Live result anchored to ${db}`);
                                void this.executeQuery(source.substring(5).trim(), {}, runBtn, resultContainer, footerInstance, {
                                    activeDatabase: anchoredDB,
                                    originId: stableId,
                                    isLive: true
                                });
                            });
                    });
                });
                menu.showAtMouseEvent(e);
            };

            const refreshBtn = dashboardLeft.createEl("button", {
                cls: "mysql-preview-refresh-btn",
                attr: { "aria-label": "Refresh data" }
            });
            setIcon(refreshBtn, "refresh-cw");
            refreshBtn.onclick = () => {
                refreshBtn.addClass("is-spinning");
                void this.executeQuery(source.substring(5).trim(), {}, runBtn, resultContainer, footerInstance, {
                    activeDatabase: anchoredDB,
                    originId: stableId,
                    isLive: true
                }).finally(() => {
                    setTimeout(() => refreshBtn.removeClass("is-spinning"), 600);
                });
            };

            void this.executeQuery(source.substring(5).trim(), {}, runBtn, resultContainer, footerInstance, {
                activeDatabase: anchoredDB,
                originId: stableId,
                isLive: true
            });

            footerInstance.setLive();

            const eventBus = DatabaseEventBus.getInstance();
            const debouncedExec = debounce(() => {
                void this.executeQuery(source.substring(5).trim(), {}, runBtn, resultContainer, footerInstance, {
                    activeDatabase: anchoredDB,
                    originId: stableId,
                    isLive: true
                });
            }, 500);

            const onModified = (event: DatabaseChangeEvent) => {
                if (stableId && event.originId === stableId) return;
                if (event.database !== anchoredDB) return;
                const hasIntersection = event.tables.length === 0 || event.tables.some(t => observedTables.includes(t.toLowerCase()));
                if (hasIntersection) debouncedExec();
            };

            eventBus.onDatabaseModified(onModified);
            ctx.addChild(new LiveSyncComponent(el, eventBus, onModified));
        }
    }

    private appendHighlightedCode(container: HTMLElement, code: string): void {
        const highlighted = Prism.highlight(code, Prism.languages.sql, 'sql');
        const parser = new DOMParser();
        const doc = parser.parseFromString(highlighted, 'text/html');

        const dangerousTags = ['script', 'iframe', 'img', 'object', 'embed', 'link'];
        dangerousTags.forEach(tag => {
            doc.querySelectorAll(tag).forEach(el => el.remove());
        });

        doc.querySelectorAll('*').forEach(el => {
            const attrs = el.attributes;
            for (let i = 0; i < attrs.length; i++) {
                if (attrs[i].name.startsWith('on') || attrs[i].name.startsWith('javascript:')) {
                    el.removeAttribute(attrs[i].name);
                }
            }
        });

        Array.from(doc.body.childNodes).forEach(node => {
            const newNode = node.ownerDocument !== container.ownerDocument ?
                container.ownerDocument.importNode(node, true) : node;
            container.appendChild(newNode);
        });
    }

    private renderParameterInputs(params: Record<string, unknown>, container: HTMLElement, runBtn: HTMLButtonElement, onParamsChange: (params: Record<string, unknown>) => void) {
        const inputsContainer = container.createEl("div", { cls: "mysql-params" });
        const currentParams = { ...params };

        Object.keys(params).forEach(key => {
            const wrapper = inputsContainer.createEl("div", { cls: "mysql-param-wrapper" });
            wrapper.createEl("label", { text: key });
            const input = wrapper.createEl("input", {
                type: "text",
                value: (params[key] !== null && typeof params[key] === 'object') ? JSON.stringify(params[key]) : String(params[key] as string | number | boolean ?? "")
            });
            input.oninput = () => {
                currentParams[key] = input.value;
                onParamsChange(currentParams);
            };
            input.onkeydown = (e) => {
                if (e.key === 'Enter') runBtn.click();
            }
        });
    }

    private async executeQuery(query: string, params: Record<string, unknown>, btn: HTMLButtonElement, container: HTMLElement, footer?: WorkbenchFooter, options: { activeDatabase?: string, originId?: string, isLive?: boolean } = {}): Promise<void> {
        btn.disabled = true;
        const workbench = container.closest('.mysql-workbench-container');
        if (options.isLive && workbench) workbench.addClass('is-loading');

        const controls = container.parentElement?.querySelector('.mysql-controls');
        const cancelBtn = controls?.createEl("button", { cls: "mysql-btn mysql-btn-warn" });
        if (cancelBtn) {
            setIcon(cancelBtn, "stop-circle");
            cancelBtn.createSpan({ text: t('workbench.btn_cancel') });
        }

        const abortController = new AbortController();
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                abortController.abort();
                cancelBtn.remove();
                btn.disabled = false;
                btn.empty();
                setIcon(btn, "play");
                btn.createSpan({ text: t('workbench.btn_run') });
                if (footer) footer.setAborted();
                new Notice(t('workbench.notice_aborted'));
            };
        }

        btn.empty();
        btn.createSpan({ text: `⏳ ${t('workbench.btn_executing')}` });
        if (footer) footer.setStatus(t('workbench.btn_executing'), true);

        let finalQuery = query;
        if (Object.keys(params).length > 0) {
            finalQuery = this.injectParams(query, params);
        }

        try {
            const result = await QueryExecutor.execute(finalQuery, undefined, {
                safeMode: this.settings.safeMode,
                signal: abortController.signal,
                activeDatabase: options.activeDatabase || this.activeDatabase,
                originId: options.originId,
                isLive: options.isLive
            });

            if (cancelBtn) cancelBtn.remove();
            ResultRenderer.render(result, container, this.app, this, undefined, options.isLive);

            if (result.activeDatabase) this.activeDatabase = result.activeDatabase;
            if (footer && result.executionTime !== undefined) footer.updateTime(result.executionTime);

            if (result.success && this.settings.autoSave) {
                const cleanQuery = query.trim().toUpperCase();
                if (!cleanQuery.startsWith('SELECT') && !cleanQuery.startsWith('SHOW')) {
                    void this.debouncedSave();
                }
            }
        } catch (e) {
            if (cancelBtn) cancelBtn.remove();
            ResultRenderer.render({ success: false, error: (e as Error).message }, container, this.app, this);
            if (footer) footer.setError();
        } finally {
            if (options.isLive && workbench) workbench.removeClass('is-loading');
            if (footer) footer.setStatus("Ready");
            btn.disabled = false;
            btn.empty();
            setIcon(btn, "play");
            btn.createSpan({ text: t('workbench.btn_run') });
        }
    }

    private injectParams(query: string, params: Record<string, unknown>): string {
        let injected = query;
        for (const [key, value] of Object.entries(params)) {
            const safeValue = SQLSanitizer.escapeValue(value);
            const regex = new RegExp(`[: @]${key}\\b`, 'g');
            injected = injected.replace(regex, safeValue);
        }
        return injected;
    }

    private showTables(container: HTMLElement, btn: HTMLButtonElement): void {
        try {
            const activeDB = this.activeDatabase;
            const tables = (alasql as (s: string) => Record<string, unknown>[])(`SHOW TABLES FROM ${activeDB}`);

            if (tables.length === 0) {
                container.empty();
                const infoState = container.createDiv({ cls: "mysql-info-state" });
                const content = infoState.createDiv({ cls: "u-display-flex u-flex-column u-align-center u-text-center" });
                const titleRow = content.createDiv({ cls: "u-display-flex u-align-center u-gap-md u-justify-center" });
                const iconWrapper = titleRow.createDiv({ cls: "mysql-info-icon" });
                setIcon(iconWrapper, "info");
                const msg = titleRow.createEl("p", { cls: "mysql-info-text" });
                msg.setText("No tables found in database ");
                msg.createSpan({ text: activeDB, cls: "mysql-accent u-font-bold" });

                const help = content.createEl("p", {
                    text: t('modals.switch_db_help'),
                    cls: "u-text-small u-text-muted u-margin-top-xs u-margin-bottom-none"
                });
                const settingsBtn = help.createEl("a", {
                    text: t('modals.btn_open_settings'),
                    cls: "mysql-accent u-cursor-pointer u-text-underline"
                });
                settingsBtn.onclick = () => {
                    const settingApp = (this.app as unknown as { setting: { open: () => void, openTabById: (id: string) => void } });
                    if (settingApp.setting?.open) settingApp.setting.open();
                    if (settingApp.setting?.openTabById) settingApp.setting.openTabById(this.manifest.id);
                };
                new Notice("No tables found");
                return;
            }

            container.empty();
            const explorerHeader = container.createDiv({ cls: "mysql-result-header" });
            const headerLeft = explorerHeader.createDiv({ cls: "mysql-header-left" });
            setIcon(headerLeft, "database");
            headerLeft.createSpan({ text: t('renderer.title_results'), cls: "mysql-result-label" });

            const grid = container.createEl("div", { cls: "mysql-table-grid" });
            tables.forEach((table: unknown) => {
                const t = table as { tableid: string };
                const card = grid.createEl("div", { cls: "mysql-table-card" });
                const iconSlot = card.createDiv({ cls: "mysql-card-icon" });
                setIcon(iconSlot, "table");
                card.createEl("strong", { text: t.tableid });

                card.onclick = async () => {
                    container.empty();
                    const header = container.createEl("div", { cls: "mysql-result-header" });
                    const left = header.createDiv({ cls: "mysql-header-left" });
                    const back = left.createEl("button", { cls: "mysql-action-btn", attr: { title: "Go back to tables list" } });
                    setIcon(back, "arrow-left");
                    back.createSpan({ text: "Back" });
                    back.onclick = (e) => {
                        e.stopPropagation();
                        btn.click();
                    };

                    const right = header.createDiv({ cls: "mysql-header-right" });
                    const exportBtn = right.createEl("button", { cls: "mysql-action-btn" });
                    setIcon(exportBtn, "file-output");
                    exportBtn.createSpan({ text: "Export CSV" });
                    exportBtn.onclick = () => this.csvManager.exportTable(t.tableid);

                    const dataContainer = container.createDiv({ cls: "mysql-table-detail-content" });
                    const result = await QueryExecutor.execute(`SELECT * FROM ${activeDB}.${t.tableid}`);
                    ResultRenderer.render(result, dataContainer, this.app, this, t.tableid);
                };
            });
        } catch (error) {
            new Notice("Error showing tables: " + (error as Error).message);
        }
    }

    private resetDatabase(container: HTMLElement, footer?: WorkbenchFooter): void {
        new ConfirmationModal(
            this.app,
            "Reset Database",
            "This will delete ALL databases and tables. This action cannot be undone. Are you sure?",
            (confirmed) => {
                void (async () => {
                    if (confirmed) {
                        try {
                            await this.dbManager.reset();
                            container.empty();
                            if (footer) footer.setActiveDatabase('dbo');
                            const successState = container.createDiv({ cls: "mysql-success-state" });
                            const iconWrapper = successState.createDiv({ cls: "mysql-success-icon" });
                            setIcon(iconWrapper, "check-circle");
                            successState.createEl("p", { text: "All databases reset successfully", cls: "mysql-success" });
                            new Notice("Database reset completed");
                        } catch (error) {
                            new Notice("Reset failed: " + (error as Error).message);
                        }
                    }
                })();
            },
            "Reset Everything",
            "Keep Data"
        ).open();
    }
}
