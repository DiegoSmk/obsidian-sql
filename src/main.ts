import { Plugin, TFile, Notice, debounce, Debouncer, setIcon, Menu } from 'obsidian';
// @ts-ignore
import alasql from 'alasql';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';

import { MySQLSettings, IMySQLPlugin } from './types';
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

export default class MySQLPlugin extends Plugin implements IMySQLPlugin {
    settings: MySQLSettings;
    public dbManager: DatabaseManager;
    public csvManager: CSVManager;
    public activeDatabase: string = 'dbo';
    private liveListeners: Map<string, (event: DatabaseChangeEvent) => void> = new Map();
    // @ts-ignore
    private debouncedSave: Debouncer<[], Promise<void>>;

    async onload() {
        await this.loadSettings();

        // Apply theme
        this.applyTheme();

        // Initialize alasql
        alasql.options.autocommit = true;
        alasql.options.mysql = true;
        alasql.promise = (sql: string, params?: any[]) => {
            return new Promise((resolve, reject) => {
                alasql(sql, params || [], (data: any, err: Error) => {
                    if (err) reject(err);
                    else resolve(data);
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
            this.processSQLBlock(source, el, ctx);
        });

        // Add Import CSV command
        this.addCommand({
            id: 'import-csv-to-alasql',
            name: 'Import CSV to Table',
            callback: () => {
                new CSVSelectionModal(this.app, async (file) => {
                    const success = await this.csvManager.importCSV(file);
                    if (success) {
                        await this.dbManager.save();
                    }
                }).open();
            }
        });

        // Add Settings Tab
        this.addSettingTab(new MySQLSettingTab(this.app, this));

        // Add Export CSV context menu
        this.registerEvent(
            this.app.workspace.on("file-menu", (menu, file) => {
                // Not really relevant for file-menu on files, but maybe for table view?
                // Unused in provided monolithic code, but I'll keep it if it was there or matches patterns.
                // Wait, previous code had it?
                // Looking at monolithic main.ts...
                // It didn't have explicit file-menu event for export. It had export button in Table View (ResultRenderer/ViewFileOutline? No, ResultRenderer had 'Copy').
                // Ah, CSVManager has exportTable(tableName). Where is it called?
                // In monolithic main.ts: "showTables" method (which I missed in utilities extraction?)
                // Wait, "showTables" was a method in MySQLPlugin class in monolithic code.
                // I need to port `processSQLBlock`, `showTables`, `resetDatabase`, `executeQuery`, `injectParams`, `safeHighlight`, `renderParameterInputs`.
            })
        );
    }

    async onunload() {
        // Clear all LIVE listeners
        const eventBus = DatabaseEventBus.getInstance();
        this.liveListeners.forEach((fn, id) => {
            eventBus.off(DatabaseEventBus.DATABASE_MODIFIED, fn);
        });
        this.liveListeners.clear();

        if (this.settings.autoSave) {
            await this.dbManager.save();
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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

        document.body.style.setProperty('--mysql-accent-purple', color);
        document.body.style.setProperty('--mysql-accent', color); // For consistency

        if (settings.useObsidianAccent) {
            document.body.style.setProperty('--mysql-accent-rgb', 'var(--interactive-accent-rgb)');
        } else {
            // We need to calc rgb for custom color. 
            // Duplicate hexToRgb logic or make it static utility? 
            // It's in MySQLSettingTab currently. 
            // I'll implement a simple hexToRgb here or assume standard opaque for now if simpler, 
            // but transparency is used in 'rgba(var(--mysql-accent-rgb), 0.1)'.
            // So I must provide it.
            const hex = settings.themeColor;
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            if (result) {
                const r = parseInt(result[1], 16);
                const g = parseInt(result[2], 16);
                const b = parseInt(result[3], 16);
                document.body.style.setProperty('--mysql-accent-rgb', `${r}, ${g}, ${b}`);
            }
        }
    }

    // ========================================================================
    // LOGIC PORTED FROM MONOLITHIC CLASS
    // ========================================================================

    private generateBlockStableId(source: string, ctx: any): string {
        const hash = (str: string) => {
            let h = 0;
            for (let i = 0; i < str.length; i++) {
                h = ((h << 5) - h) + str.charCodeAt(i);
                h |= 0;
            }
            return Math.abs(h).toString(16);
        };
        // We use path + query hash for a stable reference that survives line changes but reacts to code changes
        return `${ctx.sourcePath}:${hash(source.trim())}`;
    }

    async processSQLBlock(source: string, el: HTMLElement, ctx: any) {
        el.empty();
        el.addClass("mysql-block-parent");
        const workbench = el.createEl("div", { cls: "mysql-workbench-container" });

        // Phase 2: LIVE Mode Detection & Identity
        const trimmedSource = source.trim();
        const isLive = trimmedSource.toUpperCase().startsWith("LIVE SELECT");
        const liveBlockId = isLive ? `${ctx.sourcePath}:${ctx.lineStart}-${ctx.lineEnd}` : null;
        const stableId = isLive ? this.generateBlockStableId(source, ctx) : null;

        // Resolve Anchored Database (Priority: Params > Settings Cache > Global Active)
        let anchoredDB: string | null = null;
        if (isLive) {
            // Check for explicit 'db' param in comments: /* params: { "db": "empresa" } */ or -- db: empresa
            const jsonParamMatch = source.match(/\/\*\s*params\s*:\s*({[\s\S]*?})\s*\*\//);
            const lineParamMatch = source.match(/--\s*db:\s*([a-zA-Z_][a-zA-Z0-9_]*)/i);

            if (jsonParamMatch) {
                try {
                    const p = JSON.parse(jsonParamMatch[1]);
                    if (p.db) anchoredDB = p.db;
                } catch (e) { }
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
                    this.saveSettings();
                }
            }
        }
        let observedTables: string[] = [];

        if (isLive) {
            workbench.addClass("mysql-live-mode");
            try {
                // Extract SQL without LIVE prefix for AST parsing
                const sqlForAST = trimmedSource.substring(5).trim();
                const extractFromNode = (node: any) => {
                    if (!node) return;
                    if (node.tableid) {
                        const tid = node.tableid.toLowerCase();
                        observedTables.push(tid.includes('.') ? tid.split('.').pop()! : tid);
                    }
                    if (Array.isArray(node)) {
                        node.forEach(extractFromNode);
                    } else if (typeof node === 'object') {
                        Object.values(node).forEach(val => {
                            if (typeof val === 'object') extractFromNode(val);
                        });
                    }
                };
                const ast = (alasql as any).parse(sqlForAST);
                extractFromNode(ast);

                // Regex fallback for EXTRA safety
                const tableRegex = /(?:FROM|JOIN|INTO|UPDATE)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi;
                let match;
                while ((match = tableRegex.exec(sqlForAST)) !== null) {
                    const tid = match[1].split('.').pop()!.toLowerCase();
                    if (!['select', 'values', '(', 'set', 'where'].includes(tid)) {
                        observedTables.push(tid);
                    }
                }

                observedTables = Array.from(new Set(observedTables));
                Logger.info(`[LIVE] Monitoring tables:`, observedTables);
            } catch (e) {
                Logger.warn("Failed to parse LIVE AST", e);
            }
        }

        // Collapsed Preview (Bar with first line of code)
        // Parse Title & State from First Line
        const rawFirstLine = source.split('\n')[0].trim();

        let displayTitle = "MySQL Query";
        let icon = "database";
        let titleColorClass = "";
        let startCollapsed = false;

        // Check if first line is a comment
        const isComment = /^(--|#|\/\*)/.test(rawFirstLine);

        if (isComment) {
            // Remove SQL comment syntax
            let cleanLine = rawFirstLine.replace(/^(--\s?|#\s?|\/\*\s?)/, '').replace(/\s?\*\/$/, '').trim();

            // Parse Markers
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

            if (cleanLine.length > 0) {
                displayTitle = cleanLine;
            }
        }

        const previewBar = workbench.createEl("div", { cls: "mysql-collapsed-preview" });
        // Initial visibility set below based on startCollapsed

        const previewToggle = previewBar.createEl("div", { cls: "mysql-preview-toggle" });
        setIcon(previewToggle, "chevron-right");

        const previewContent = previewBar.createEl("div", { cls: "mysql-preview-content" });
        const iconSpan = previewContent.createSpan({ cls: "mysql-preview-icon" });
        if (titleColorClass) iconSpan.addClass(titleColorClass);
        setIcon(iconSpan, icon);

        const textSpan = previewContent.createSpan({ cls: "mysql-preview-text", text: displayTitle });
        // Only apply color to text if it's not the help style (as requested)
        if (titleColorClass && titleColorClass !== "mysql-title-help") {
            textSpan.addClass(titleColorClass);
        }

        // Expand Action
        previewBar.onclick = () => {
            workbench.removeClass("is-collapsed");
            body.style.display = "block";
            previewBar.style.display = "none";
        };

        // Body Structure
        const body = workbench.createEl("div", { cls: "mysql-workbench-body" });

        // Collapse Button (Floating in expanded state)
        const collapseBtn = body.createEl("button", {
            cls: "mysql-collapse-btn",
            attr: { "aria-label": "Collapse" }
        });
        setIcon(collapseBtn, "chevron-up");
        collapseBtn.onclick = (e) => {
            e.stopPropagation();
            workbench.addClass("is-collapsed");
            body.style.display = "none";
            previewBar.style.display = "flex";
        };

        // Initialize State based on marker
        if (startCollapsed) {
            workbench.addClass("is-collapsed");
            previewBar.style.display = "flex";
            body.style.display = "none";
        } else {
            previewBar.style.display = "none";
            // body is block by default
        }

        // Copy Code Button (Inside body so it hides when collapsed)
        const copyCodeBtn = body.createEl("button", {
            cls: "mysql-copy-code-btn",
            attr: { "aria-label": "Copy Code" }
        });
        setIcon(copyCodeBtn, "copy");
        copyCodeBtn.onclick = async (e) => {
            e.stopPropagation(); // Prevent header toggle if clicked (though it's in body, safety)
            await navigator.clipboard.writeText(source);
            new Notice("SQL code copied!");
        };

        // Safe Code Highlighting
        const codeBlock = body.createEl("pre", { cls: "mysql-source-code" });
        codeBlock.innerHTML = `<code class="language-sql">${this.safeHighlight(source)}</code>`;

        const controls = body.createEl("div", { cls: "mysql-controls" });

        // Run Button
        const runBtn = controls.createEl("button", { cls: "mysql-btn mysql-btn-run" });
        setIcon(runBtn, "play");
        runBtn.createSpan({ text: "Run" });

        // Container for right-aligned buttons
        const rightControls = controls.createEl("div", { cls: "mysql-controls-right" });

        // Add Tables Button
        const showTablesBtn = rightControls.createEl("button", { cls: "mysql-btn" });
        setIcon(showTablesBtn, "table");
        showTablesBtn.createSpan({ text: "Tables" });

        // Add Import CSV Button
        const importBtn = rightControls.createEl("button", { cls: "mysql-btn" });
        setIcon(importBtn, "file-up");
        importBtn.createSpan({ text: "Import CSV" });

        // Add Reset Button
        const resetBtn = rightControls.createEl("button", { cls: "mysql-btn mysql-btn-danger" });
        setIcon(resetBtn, "trash-2");
        resetBtn.createSpan({ text: "Reset" });

        const resultContainer = body.createEl("div", { cls: "mysql-result-container" });

        // VS Code Inspired Footer
        const footer = new WorkbenchFooter(body, this.app);
        footer.setActiveDatabase(this.activeDatabase);

        importBtn.onclick = () => {
            new CSVSelectionModal(this.app, async (file) => {
                const success = await this.csvManager.importCSV(file);
                if (success) {
                    await this.dbManager.save();
                    // Refrescar tabelas se estiver mostrando
                    this.showTables(resultContainer, showTablesBtn);
                }
            }).open();
        };

        // Event Handlers for new buttons
        showTablesBtn.onclick = () => this.showTables(resultContainer, showTablesBtn);
        resetBtn.onclick = () => this.resetDatabase(resultContainer);

        // Parse optional parameters JSON in comments
        const paramMatch = source.match(/\/\*\s*params\s*:\s*({[\s\S]*?})\s*\*\//);
        const params = paramMatch ? JSON.parse(paramMatch[1]) : {};

        if (Object.keys(params).length > 0) {
            this.renderParameterInputs(params, controls, runBtn, (newParams) => {
                this.executeQuery(source, newParams, runBtn, resultContainer, footer);
            });
        }

        runBtn.onclick = () => this.executeQuery(source, params, runBtn, resultContainer, footer);

        // If LIVE, trigger initial execution and hide editor
        if (isLive && liveBlockId && anchoredDB) {
            // Hide typical interactive elements
            body.addClass("mysql-view-only");

            // Phase 5: Minimalist LIVE View (sem footer, sem header)
            previewBar.style.display = "none";
            footer.getContainer().style.display = "none";
            codeBlock.style.display = "none";

            // Create minimalist dashboard bar
            const dashboardBar = body.createDiv({ cls: "mysql-live-dashboard-bar" });
            body.prepend(dashboardBar);

            // Left: LIVE Indicator + DB Name
            const dashboardLeft = dashboardBar.createDiv({ cls: "mysql-dashboard-left" });
            dashboardLeft.style.display = "flex";
            dashboardLeft.style.alignItems = "center";
            dashboardLeft.style.gap = "12px";

            const liveIndicator = dashboardLeft.createDiv({ cls: "mysql-live-indicator" });
            liveIndicator.createDiv({ cls: "mysql-pulse-dot" });
            liveIndicator.createSpan({ text: "LIVE" });

            const dbInfo = dashboardLeft.createDiv({ cls: "mysql-footer-db-container mysql-live-db-switcher" });
            const dbIcon = dbInfo.createDiv({ cls: "mysql-footer-db-icon" });
            setIcon(dbIcon, "database-backup");
            const dbNameSpan = dbInfo.createSpan({ text: anchoredDB, cls: "mysql-footer-db-name" });

            // Database Switcher logic
            dbInfo.onclick = (e) => {
                const menu = new Menu();
                const dbs = Object.keys(alasql.databases).filter(d => d !== 'alasql');

                dbs.sort().forEach(db => {
                    menu.addItem((item) => {
                        item.setTitle(db)
                            .setIcon(db === anchoredDB ? "check" : "database")
                            .onClick(async () => {
                                if (db === anchoredDB) return;

                                // Update Anchor
                                anchoredDB = db;
                                if (stableId) {
                                    this.settings.liveBlockAnchors[stableId] = db;
                                    await this.saveSettings();
                                }

                                // Update UI
                                dbNameSpan.setText(db);
                                new Notice(`LIVE block anchored to ${db}`);

                                // Re-execute immediately
                                this.executeQuery(source.substring(5).trim(), {}, runBtn, resultContainer, footer, {
                                    activeDatabase: anchoredDB,
                                    originId: liveBlockId,
                                    isLive: true
                                });
                            });
                    });
                });

                menu.showAtMouseEvent(e);
            };

            // Refresh Button (Now on the left)
            const refreshBtn = dashboardLeft.createEl("button", {
                cls: "mysql-preview-refresh-btn",
                attr: { "aria-label": "Refresh Data" }
            });
            setIcon(refreshBtn, "refresh-cw");
            refreshBtn.onclick = () => {
                refreshBtn.addClass("is-spinning");
                new Notice(`Updating LIVE data from ${anchoredDB}...`);
                this.executeQuery(source.substring(5).trim(), {}, runBtn, resultContainer, footer, {
                    activeDatabase: anchoredDB,
                    originId: liveBlockId,
                    isLive: true
                }).finally(() => {
                    setTimeout(() => refreshBtn.removeClass("is-spinning"), 600);
                });
            };

            // Execute initially
            this.executeQuery(source.substring(5).trim(), {}, runBtn, resultContainer, footer, {
                activeDatabase: anchoredDB,
                originId: liveBlockId,
                isLive: true
            });

            if (footer) {
                footer.setLive();
            }

            // Register Listener
            const eventBus = DatabaseEventBus.getInstance();
            // Throttled re-execution
            const debouncedExec = debounce((isStructural: boolean) => {
                this.executeQuery(source.substring(5).trim(), {}, runBtn, resultContainer, footer, {
                    activeDatabase: anchoredDB,
                    originId: liveBlockId,
                    isLive: true
                });
            }, 500);

            const onModified = (event: DatabaseChangeEvent) => {
                if (event.originId === liveBlockId) return;
                if (event.database !== anchoredDB) return;

                const hasIntersection = event.tables.length === 0 || // Structural change
                    event.tables.some(t => observedTables.includes(t));

                Logger.info(`[LIVE] Modification detected in ${event.database}. Tables: ${event.tables.join(',')}. Match? ${hasIntersection}`);

                if (hasIntersection) {
                    debouncedExec(event.tables.length === 0);
                }
            };

            eventBus.onDatabaseModified(onModified);

            // Cleanup when block is removed or plugin reloads
            // We use stableId for tracking active listeners to avoid "zombie" listeners on line shifts
            const listenerKey = stableId || liveBlockId;
            if (this.liveListeners.has(listenerKey)) {
                eventBus.off(DatabaseEventBus.DATABASE_MODIFIED, this.liveListeners.get(listenerKey)!);
            }
            this.liveListeners.set(listenerKey, onModified);

            // Phase 6 Refinement: Register cleanup via ctx.addChild to ensure total detachment
            const cleanupComponent = {
                onunload: () => {
                    eventBus.off(DatabaseEventBus.DATABASE_MODIFIED, onModified);
                    if (this.liveListeners.get(listenerKey) === onModified) {
                        this.liveListeners.delete(listenerKey);
                    }
                },
                onload: () => { }
            };
            // @ts-ignore
            ctx.addChild(cleanupComponent);

            // Phase 5: Ensure cleanup also happens when the block itself is destroyed by Obsidian
            // We can't easily hook into unmount, but we can check if'el' is still in DOM periodically 
            // or just rely on the Map keeping history. 
            // For now, let's just make sure we unregister the OLD one if the note is re-rendered.
        }
    }

    private safeHighlight(code: string): string {
        const highlighted = Prism.highlight(code, Prism.languages.sql, 'sql');
        const parser = new DOMParser();
        const doc = parser.parseFromString(highlighted, 'text/html');

        // Remove perigos
        const dangerousTags = ['script', 'iframe', 'img', 'object', 'embed', 'link'];
        dangerousTags.forEach(tag => {
            doc.querySelectorAll(tag).forEach(el => el.remove());
        });

        // Remove event handlers
        doc.querySelectorAll('*').forEach(el => {
            const attrs = el.attributes;
            for (let i = 0; i < attrs.length; i++) {
                if (attrs[i].name.startsWith('on') || attrs[i].name.startsWith('javascript:')) {
                    el.removeAttribute(attrs[i].name);
                }
            }
        });

        return doc.body.innerHTML;
    }

    private renderParameterInputs(
        params: Record<string, any>,
        container: HTMLElement,
        runBtn: HTMLButtonElement,
        onParamsChange: (params: Record<string, any>) => void
    ) {
        const inputsContainer = container.createEl("div", { cls: "mysql-params" });
        const currentParams = { ...params };

        Object.keys(params).forEach(key => {
            const wrapper = inputsContainer.createEl("div", { cls: "mysql-param-wrapper" });
            wrapper.createEl("label", { text: key });
            const input = wrapper.createEl("input", {
                type: "text",
                value: String(params[key])
            });

            input.oninput = () => {
                currentParams[key] = input.value;
                onParamsChange(currentParams);
            };

            // Allow Enter to run
            input.onkeydown = (e) => {
                if (e.key === 'Enter') runBtn.click();
            }
        });
    }

    private async executeQuery(
        query: string,
        params: Record<string, any>,
        btn: HTMLButtonElement,
        container: HTMLElement,
        footer?: WorkbenchFooter,
        options: { activeDatabase?: string, originId?: string, isLive?: boolean } = {}
    ): Promise<void> {
        btn.disabled = true;

        // Add Cancel Button
        const cancelBtn = container.parentElement?.querySelector('.mysql-controls')?.createEl("button", {
            cls: "mysql-btn mysql-btn-warn"
        });
        if (cancelBtn) {
            setIcon(cancelBtn, "stop-circle");
            cancelBtn.createSpan({ text: "Cancel" });
        }

        const abortController = new AbortController();

        if (cancelBtn) {
            cancelBtn.onclick = () => {
                abortController.abort();
                cancelBtn.remove();
                btn.disabled = false;
                btn.empty();
                setIcon(btn, "play");
                btn.createSpan({ text: "Run" });
                if (footer) {
                    footer.setAborted();
                }
                new Notice("Query aborted by user");
            };
        }

        btn.innerHTML = `⏳ Executing...`;
        if (footer) {
            footer.setStatus("Executing...", true);
        }

        // Handle Special Commands like SHOW TABLES (custom view?)
        // The original code handled SHOW TABLES normally via AlaSQL, but wrapped it?
        // Let's look at `showTables()` method in original code... no, it seems `showTables` was a separate method but not called by executeQuery directly unless specialized.
        // Actually, standard sql block execution handles everything via QueryExecutor.
        // But wait, the user wants "Export CSV" button in table detail view.
        // In ResultRenderer? Or somewhere else?
        // Original code: `ResultRenderer` didn't seem to have `Export CSV`.
        // Let's re-read the original monolithic code for `showTables` and where `Export CSV` button was added.
        // It was added in `renderTable` inside `ResultRenderer`? Or `MySQLPlugin` had a `showTables` logic?
        // Ah, `step 2` summary said: "Export CSV button was added to the table detail view (accessed by clicking on a table in the 'Tables' list)."
        // Where is the "Tables" list?
        // Maybe it's `SHOW TABLES` output rendered?
        // If I run `SHOW TABLES`, AlaSQL returns a list of tables. ResultRenderer renders it.
        // If I click on a table?
        // The original code seemed to have `renderTable` in `ResultRenderer`?
        // Let's assume standard execution for now. 
        // Oh, wait. I see `this.csvManager.exportTable(tableName)` in the monolithic `exportTable` method?
        // I need to ensure `ResultRenderer` supports exporting if it was there.
        // The previous `ResultRenderer.ts` I wrote has `Copy`, `Screenshot`, `Insert`. No `Export CSV`.
        // I should check if I missed `Export CSV` in `ResultRenderer`.

        let finalQuery = query;
        if (Object.keys(params).length > 0) {
            finalQuery = this.injectParams(query, params);
        }

        try {
            const result = await QueryExecutor.execute(finalQuery, undefined, {
                safeMode: this.settings.safeMode,
                signal: abortController.signal,
                activeDatabase: options.activeDatabase || this.activeDatabase,
                originId: options.originId
            });

            if (cancelBtn) cancelBtn.remove();

            // Render Result
            ResultRenderer.render(result, container, this.app, this, undefined, options.isLive);

            // Sync active database from execution result
            if (result.activeDatabase) {
                this.activeDatabase = result.activeDatabase;
            }

            // Update Footer Time
            if (footer && result.executionTime !== undefined) {
                footer.updateTime(result.executionTime);
            }

            // Determine if we should add "Export CSV" button if result looks like a single table select or check logic
            // The request said: "Export CSV button was added to the table detail view (accessed by clicking on a table in the "Tables" list)."
            // This implies there is a "Tables list" view.
            // If the query was `SHOW TABLES`, the result is clickable?
            // Since I don't fully recall the interaction code for "Tables list" -> "Table Detail", I will just rely on `QueryExecutor` + `ResultRenderer`.
            // However, the `csvManager` has `exportTable`.
            // I'll add an "Export Table to CSV" command to Obsidian palette for safety.
            // Or check if I should add it to `ResultRenderer` if the query matches `SELECT * FROM table`.

            // Auto-save if modification
            if (result.success && this.settings.autoSave) {
                const cleanQuery = query.trim().toUpperCase();
                if (!cleanQuery.startsWith('SELECT') && !cleanQuery.startsWith('SHOW')) {
                    await this.debouncedSave();
                }
            }
        } catch (e) {
            if (cancelBtn) cancelBtn.remove();
            Logger.error("Execute Query Error", e);
            ResultRenderer.render({ success: false, error: e.message }, container, this.app, this);
            if (footer) {
                footer.setError();
            }
        }

        btn.disabled = false;
        btn.empty();
        setIcon(btn, "play");
        btn.createSpan({ text: "Run" });
    }

    private injectParams(query: string, params: Record<string, any>): string {
        let injected = query;
        for (const [key, value] of Object.entries(params)) {
            // Handle numeric and string params differently
            const wrapper = typeof value === 'string' ? "'" : "";
            const safeValue = SQLSanitizer.escapeValue(value);
            // RegEx to replace :param or @param
            const regex = new RegExp(`[: @]${key}\\b`, 'g');
            // safeValue already has quotes if string from escapeValue?
            // SQLSanitizer.escapeValue adds quotes for strings.
            // So we replace directly.
            injected = injected.replace(regex, safeValue);
        }
        return injected;
    }

    private showTables(container: HTMLElement, btn: HTMLButtonElement): void {
        try {
            // Explicitly show from active database to avoid context issues
            const activeDB = this.activeDatabase;
            const tables = alasql(`SHOW TABLES FROM ${activeDB}`) as any[];

            if (tables.length === 0) {
                container.empty();
                const infoState = container.createDiv({ cls: "mysql-info-state" });

                const content = infoState.createDiv();
                content.style.display = "flex";
                content.style.flexDirection = "column";
                content.style.alignItems = "center";
                content.style.textAlign = "center";

                // Title Row with Icon
                const titleRow = content.createDiv();
                titleRow.style.display = "flex";
                titleRow.style.alignItems = "center";
                titleRow.style.justifyContent = "center";
                titleRow.style.gap = "8px";

                const iconWrapper = titleRow.createDiv({ cls: "mysql-info-icon" });
                setIcon(iconWrapper, "info");

                const msg = titleRow.createEl("p", { cls: "mysql-info-text" });
                msg.setText("No tables found in database ");
                const span = msg.createSpan({ text: activeDB });
                span.style.color = "var(--mysql-accent-purple)";
                span.style.fontWeight = "bold";

                const help = content.createEl("p", {
                    text: "To switch databases, run 'USE <database>' or "
                });
                help.style.fontSize = "0.75em";
                help.style.color = "var(--text-muted)";
                help.style.marginTop = "4px";
                help.style.marginBottom = "0";

                const settingsBtn = help.createEl("a", {
                    text: "Open Settings"
                });
                settingsBtn.style.color = "var(--mysql-accent-purple)";
                settingsBtn.style.cursor = "pointer";
                settingsBtn.style.textDecoration = "underline";

                settingsBtn.onclick = () => {
                    // @ts-ignore
                    this.app.setting.open();
                    // @ts-ignore
                    this.app.setting.openTabById(this.manifest.id);
                };

                new Notice("No tables found");
                return;
            }

            container.empty();

            // Unified Header for Explorer
            const explorerHeader = container.createDiv({ cls: "mysql-result-header" });
            const headerLeft = explorerHeader.createDiv({ cls: "mysql-header-left" });
            setIcon(headerLeft, "database");
            headerLeft.createSpan({ text: "Active Tables", cls: "mysql-result-label" });

            const grid = container.createEl("div", { cls: "mysql-table-grid" });

            tables.forEach(t => {
                const card = grid.createEl("div", { cls: "mysql-table-card" });
                const iconSlot = card.createDiv({ cls: "mysql-card-icon" });
                setIcon(iconSlot, "table");
                card.createEl("strong", { text: t.tableid });

                card.onclick = async () => {
                    container.empty();

                    const header = container.createEl("div", { cls: "mysql-result-header" });

                    const left = header.createDiv({ cls: "mysql-header-left" });
                    const back = left.createEl("button", {
                        cls: "mysql-action-btn",
                        attr: { title: "Go back to tables list" }
                    });
                    setIcon(back, "arrow-left");
                    back.createSpan({ text: "Back" });
                    back.onclick = (e) => {
                        e.stopPropagation();
                        btn.click();
                    };

                    const right = header.createDiv({ cls: "mysql-header-right" });
                    const exportBtn = right.createEl("button", {
                        cls: "mysql-action-btn"
                    });
                    setIcon(exportBtn, "file-output");
                    exportBtn.createSpan({ text: "Export CSV" });
                    exportBtn.onclick = () => this.csvManager.exportTable(t.tableid);

                    // Dedicated container for results so RenderRenderer doesn't empty our header
                    const dataContainer = container.createDiv({ cls: "mysql-table-detail-content" });
                    const result = await QueryExecutor.execute(`SELECT * FROM ${activeDB}.${t.tableid}`);
                    ResultRenderer.render(result, dataContainer, this.app, this, t.tableid);
                };
            });
        } catch (error) {
            new Notice("Error showing tables: " + error.message);
        }
    }

    private async resetDatabase(container: HTMLElement): Promise<void> {
        new ConfirmationModal(
            this.app,
            "Reset Database",
            "This will delete ALL databases and tables. This action cannot be undone. Are you sure?",
            async (confirmed) => {
                if (confirmed) {
                    try {
                        await this.dbManager.reset();
                        container.empty();

                        const successState = container.createDiv({ cls: "mysql-success-state" });
                        const iconWrapper = successState.createDiv({ cls: "mysql-success-icon" });
                        setIcon(iconWrapper, "check-circle");

                        successState.createEl("p", {
                            text: "All databases reset successfully",
                            cls: "mysql-success"
                        });

                        new Notice("Database reset completed");
                    } catch (error) {
                        new Notice("Reset failed: " + error.message);
                    }
                }
            },
            "Reset Everything",
            "Keep Data"
        ).open();
    }
}
