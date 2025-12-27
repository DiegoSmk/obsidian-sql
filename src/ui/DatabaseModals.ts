import { App, Modal, ButtonComponent, TextComponent, Notice, setIcon } from 'obsidian';
import { IMySQLPlugin } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { QueryExecutor } from '../core/QueryExecutor';
import { ResultRenderer } from './ResultRenderer';
// @ts-ignore
import alasql from 'alasql';

export class DatabaseSwitcherModal extends Modal {
    constructor(app: App, private plugin: IMySQLPlugin, private onSelect: () => void) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mysql-switcher-modal');
        contentEl.createEl('h2', { text: 'Switch Database' });

        const dbs = Object.keys(alasql.databases).filter(db => db !== 'alasql');
        const list = contentEl.createDiv({ cls: 'mysql-db-list' });

        if (dbs.length === 0) {
            list.createDiv({ text: "No user databases found.", cls: "mysql-db-list-empty" });
            return;
        }

        dbs.forEach(dbName => {
            const dbManager = (this.plugin as any).dbManager;
            const stats = dbManager.getDatabaseStats(dbName);
            const isActive = dbName === this.plugin.activeDatabase;
            const isProtected = isActive || dbName === 'dbo';

            const item = list.createDiv({ cls: `mysql-db-list-item ${isActive ? 'is-active' : ''}` });

            // Info Area (Click to Switch)
            const infoArea = item.createDiv({ cls: 'mysql-db-list-content' });
            infoArea.style.flex = '1';
            infoArea.style.cursor = isActive ? 'default' : 'pointer';

            const info = infoArea.createDiv({ cls: 'mysql-db-list-info' });
            info.createDiv({ text: dbName, cls: 'mysql-db-list-name' });
            info.createDiv({
                text: `${stats.tables} tables • ${stats.rows.toLocaleString()} rows`,
                cls: 'mysql-db-list-meta'
            });

            if (isActive) {
                const activeBadge = item.createDiv({ text: 'ACTIVE', cls: 'mysql-db-list-badge' });
                activeBadge.style.marginLeft = 'auto'; // Right align
                activeBadge.setAttribute('aria-label', "Switch to another database to delete this one.");
            } else {
                // Not active, is it protected?
                if (isProtected) {
                    // Check if it's dbo
                    if (dbName === 'dbo') {
                        const dboBadge = item.createDiv({ cls: 'mysql-db-list-actions' });
                        dboBadge.style.marginLeft = 'auto';
                        const lockIcon = dboBadge.createDiv({ cls: 'mysql-table-icon' });
                        setIcon(lockIcon, 'lock');
                        lockIcon.setAttribute('aria-label', "System Default Database. Cannot be deleted.");
                        lockIcon.style.opacity = '0.5';
                    }
                }

                // Always allow switching if not active!
                infoArea.onclick = async () => {
                    this.switchDatabase(dbName);
                };
            }

            // Actions Area (Only for non-protected items)
            if (!isProtected) {
                const actions = item.createDiv({ cls: 'mysql-db-list-actions' });
                // If not active, ensure actions are pushed to right
                actions.style.marginLeft = 'auto';

                const deleteBtn = actions.createEl('button', {
                    cls: 'mysql-db-list-delete-btn',
                    attr: { 'aria-label': 'Delete Database' }
                });
                setIcon(deleteBtn, 'trash-2');

                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.confirmDelete(dbName);
                };
            }
        });
    }

    private async switchDatabase(dbName: string) {
        const dbManager = (this.plugin as any).dbManager;
        await alasql.promise(`USE ${dbName}`);
        this.plugin.activeDatabase = dbName;
        await dbManager.save();
        new Notice(`Switched to "${dbName}"`);
        this.onSelect();
        this.close();
    }

    private confirmDelete(dbName: string) {
        new ConfirmationModal(
            this.app,
            "Delete Database",
            `Are you sure you want to delete "${dbName}"? This action cannot be undone.`,
            async (confirmed) => {
                if (confirmed) {
                    try {
                        const dbManager = (this.plugin as any).dbManager;
                        await dbManager.deleteDatabase(dbName);
                        new Notice(`Database "${dbName}" deleted.`);
                        // Refresh the list
                        this.onOpen();
                    } catch (e) {
                        new Notice(`Error: ${e.message}`);
                    }
                }
            },
            "Delete",
            "Cancel"
        ).open();
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class RenameDatabaseModal extends Modal {
    constructor(app: App, private plugin: IMySQLPlugin, private oldName: string, private onSuccess: () => void) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mysql-rename-modal');
        contentEl.createEl('h2', { text: `Rename Database: ${this.oldName}` });

        const input = new TextComponent(contentEl)
            .setPlaceholder("New database name...")
            .setValue(this.oldName);

        input.inputEl.addClass('mysql-rename-input');
        input.inputEl.style.width = '100%';
        input.inputEl.style.marginBottom = '20px';

        const buttons = contentEl.createDiv({ cls: 'mysql-modal-footer' });

        new ButtonComponent(buttons)
            .setButtonText("Cancel")
            .onClick(() => this.close());

        const confirmBtn = new ButtonComponent(buttons)
            .setButtonText("Rename")
            .setCta()
            .onClick(async () => {
                const newName = input.getValue().trim();
                if (!newName || newName === this.oldName) {
                    this.close();
                    return;
                }

                try {
                    const dbManager = (this.plugin as any).dbManager;
                    await dbManager.renameDatabase(this.oldName, newName);
                    new Notice(`Database renamed to "${newName}"`);
                    this.onSuccess();
                    this.close();
                } catch (e) {
                    new Notice(`Error: ${e.message}`);
                }
            });
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class DatabaseTablesModal extends Modal {
    constructor(app: App, private plugin: IMySQLPlugin, private dbName: string) {
        super(app);
    }

    onOpen() {
        this.renderList();
    }

    private renderList() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mysql-tables-modal');
        contentEl.createEl('h2', { text: `Tables in "${this.dbName}"` });

        const db = alasql.databases[this.dbName];
        if (!db || !db.tables || Object.keys(db.tables).length === 0) {
            contentEl.createDiv({ text: "No tables found in this database.", cls: "mysql-empty-state" });
            return;
        }

        const list = contentEl.createDiv({ cls: 'mysql-table-list' });
        const tables = Object.keys(db.tables);

        tables.forEach(tableName => {
            const tableData = db.tables[tableName].data || [];
            const rowCount = tableData.length;
            const sizeEstimate = JSON.stringify(tableData).length;

            const item = list.createDiv({ cls: 'mysql-table-list-item' });
            item.style.cursor = 'pointer';

            // Icon
            const iconDiv = item.createDiv({ cls: 'mysql-table-icon' });
            setIcon(iconDiv, "table");

            // Info
            const info = item.createDiv({ cls: 'mysql-table-info' });
            info.createDiv({ text: tableName, cls: 'mysql-table-name' });
            info.createDiv({
                text: `${rowCount} rows • ~${this.formatBytes(sizeEstimate)}`,
                cls: 'mysql-table-meta'
            });

            // Drill-down on click
            item.onclick = () => this.showTableData(tableName);
        });
    }

    private async showTableData(tableName: string) {
        const { contentEl } = this;
        contentEl.empty();

        // Header with Back Button
        const header = contentEl.createDiv({ cls: 'mysql-modal-header' });
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '16px';

        const left = header.createDiv();
        left.style.display = 'flex';
        left.style.alignItems = 'center';
        left.style.gap = '8px';

        const backBtn = new ButtonComponent(left)
            .setIcon('arrow-left')
            .setTooltip('Back to Tables List')
            .onClick(() => this.renderList());

        // Using setAttribute/style property instead of 'style' option to avoid lint error
        const title = left.createEl('h3', { text: tableName });
        title.style.margin = '0';

        // Export Action
        const right = header.createDiv();
        new ButtonComponent(right)
            .setButtonText("Export CSV")
            .setIcon("file-down")
            .onClick(() => {
                // @ts-ignore
                if (this.plugin.csvManager) {
                    // @ts-ignore
                    this.plugin.csvManager.exportTable(tableName);
                } else {
                    new Notice("CSV Manager not available");
                }
            });

        // Data Container - Add workbench container class for proper styling
        const dataContainer = contentEl.createDiv({ cls: 'mysql-table-detail-view mysql-workbench-container' });
        const loadingMsg = dataContainer.createEl('p', { text: 'Loading data...' });
        loadingMsg.style.color = 'var(--text-muted)';

        try {
            const query = `SELECT * FROM ${this.dbName}.${tableName} LIMIT 100`;
            const result = await QueryExecutor.execute(query);

            dataContainer.empty();
            if (result.success) {
                // Create a result content wrapper to match workbench structure
                const resultWrapper = dataContainer.createDiv({ cls: 'mysql-result-content' });
                ResultRenderer.render(result, resultWrapper, this.app, this.plugin);

                if (result.data && result.data[0] && result.data[0].rowCount >= 100) {
                    const note = resultWrapper.createDiv({
                        text: "Showing first 100 rows only.",
                    });
                    note.style.fontSize = "0.8em";
                    note.style.color = "var(--text-muted)";
                    note.style.marginTop = "8px";
                    note.style.fontStyle = "italic";
                }
            } else {
                dataContainer.createDiv({ text: `Error: ${result.error}`, cls: 'mysql-error-text' });
            }
        } catch (e) {
            dataContainer.empty();
            dataContainer.createDiv({ text: `Error loading data: ${e.message}`, cls: 'mysql-error-text' });
        }
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    onClose() {
        this.contentEl.empty();
    }
}
