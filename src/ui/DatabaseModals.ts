import { App, Modal, ButtonComponent, TextComponent, Notice, setIcon } from 'obsidian';
import { IMySQLPlugin } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { QueryExecutor } from '../core/QueryExecutor';
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

export class CreateDatabaseModal extends Modal {
    constructor(app: App, private plugin: IMySQLPlugin, private onSuccess: () => void) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mysql-create-db-modal'); // Reusing or adding class
        contentEl.createEl('h2', { text: "Create New Database" });

        const input = new TextComponent(contentEl)
            .setPlaceholder("Database name (e.g., my_project)")
            .setValue("");

        input.inputEl.style.width = '100%';
        input.inputEl.style.marginBottom = '20px';

        const buttons = contentEl.createDiv({ cls: 'mysql-modal-footer' });

        new ButtonComponent(buttons)
            .setButtonText("Cancel")
            .onClick(() => this.close());

        const confirmBtn = new ButtonComponent(buttons)
            .setButtonText("Create")
            .setCta()
            .onClick(async () => {
                const dbName = input.getValue().trim();
                if (!dbName) {
                    new Notice("Database name cannot be empty.");
                    return;
                }

                try {
                    const dbManager = (this.plugin as any).dbManager;
                    await dbManager.createDatabase(dbName);
                    new Notice(`Database "${dbName}" created.`);

                    // Automatically switch to it?
                    // Usually yes, user creates DB to use it.
                    this.plugin.activeDatabase = dbName;
                    await dbManager.save();
                    new Notice(`Switched to "${dbName}"`);

                    this.onSuccess();
                    this.close();
                } catch (e) {
                    new Notice(`Error: ${e.message}`);
                }
            });

        // Focus input
        setTimeout(() => input.inputEl.focus(), 50);
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class DuplicateDatabaseModal extends Modal {
    constructor(app: App, private plugin: IMySQLPlugin, private oldName: string, private onSuccess: () => void) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mysql-duplicate-modal');
        contentEl.createEl('h2', { text: `Duplicate Database: ${this.oldName}` });

        const input = new TextComponent(contentEl)
            .setPlaceholder("New database name...")
            .setValue(`${this.oldName}_copy`);

        input.inputEl.style.width = '100%';
        input.inputEl.style.marginBottom = '20px';

        const buttons = contentEl.createDiv({ cls: 'mysql-modal-footer' });

        new ButtonComponent(buttons)
            .setButtonText("Cancel")
            .onClick(() => this.close());

        const confirmBtn = new ButtonComponent(buttons)
            .setButtonText("Duplicate")
            .setCta()
            .onClick(async () => {
                const newName = input.getValue().trim();
                if (!newName) {
                    new Notice("Database name cannot be empty.");
                    return;
                }
                if (newName === this.oldName) {
                    new Notice("New name must be different from the old name.");
                    return;
                }

                try {
                    const dbManager = (this.plugin as any).dbManager;
                    await dbManager.duplicateDatabase(this.oldName, newName);
                    new Notice(`Database duplicatd to "${newName}"`);
                    this.onSuccess();
                    this.close();
                } catch (e) {
                    new Notice(`Error: ${e.message}`);
                }
            });

        setTimeout(() => input.inputEl.focus(), 50);
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class DatabaseTablesModal extends Modal {
    constructor(app: App, private plugin: IMySQLPlugin, private dbName: string) {
        super(app);
        // Remove the default close button
        this.modalEl.querySelector('.modal-close-button')?.remove();
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

        // Header with improved button layout
        const header = contentEl.createDiv({ cls: 'mysql-table-detail-header' });

        const left = header.createDiv({ cls: 'mysql-table-detail-title' });
        left.style.display = 'flex';
        left.style.alignItems = 'center';
        left.style.gap = '8px';

        new ButtonComponent(left)
            .setIcon('arrow-left')
            .setTooltip('Back to Tables List')
            .onClick(() => this.renderList());

        const title = left.createEl('h3', { text: tableName });
        title.style.margin = '0';

        // Actions on the right with better spacing
        const actions = header.createDiv({ cls: 'mysql-table-detail-actions' });

        // Copy button
        new ButtonComponent(actions)
            .setIcon("copy")
            .setTooltip('Copy to clipboard')
            .onClick(async () => {
                try {
                    const query = `SELECT * FROM ${this.dbName}.${tableName}`;
                    const result = await QueryExecutor.execute(query);

                    if (result.success && result.data && result.data[0] && result.data[0].data) {
                        await this.copyToClipboard(result.data[0].data);
                    } else {
                        new Notice("No data to copy");
                    }
                } catch (e) {
                    new Notice(`Copy failed: ${e.message}`);
                }
            });

        // Screenshot button
        new ButtonComponent(actions)
            .setIcon("camera")
            .setTooltip('Take screenshot')
            .onClick(async () => {
                try {
                    const tableElement = dataContainer.querySelector('.mysql-direct-table-wrapper');
                    if (tableElement) {
                        await this.takeScreenshot(tableElement as HTMLElement);
                    } else {
                        new Notice("No table to screenshot");
                    }
                } catch (e) {
                    new Notice(`Screenshot failed: ${e.message}`);
                }
            });

        // Add to note button
        new ButtonComponent(actions)
            .setIcon("file-plus")
            .setTooltip('Add to note')
            .onClick(async () => {
                try {
                    const query = `SELECT * FROM ${this.dbName}.${tableName}`;
                    const result = await QueryExecutor.execute(query);

                    if (result.success && result.data && result.data[0] && result.data[0].data) {
                        await this.insertIntoNote(result.data[0].data);
                    } else {
                        new Notice("No data to insert");
                    }
                } catch (e) {
                    new Notice(`Insert failed: ${e.message}`);
                }
            });

        // Export button with correct icon
        new ButtonComponent(actions)
            .setIcon("download")
            .setTooltip('Export CSV')
            .onClick(async () => {
                try {
                    // Get the table data and export manually since CSVManager doesn't handle database context
                    const query = `SELECT * FROM ${this.dbName}.${tableName}`;
                    const result = await QueryExecutor.execute(query);

                    if (result.success && result.data && result.data[0] && result.data[0].data) {
                        await this.exportTableData(tableName, result.data[0].data);
                    } else {
                        new Notice("No data to export");
                    }
                } catch (e) {
                    new Notice(`Export failed: ${e.message}`);
                }
            });

        // Close button
        new ButtonComponent(actions)
            .setIcon('x')
            .setTooltip('Close')
            .onClick(() => this.close());

        // Separator line
        const separator = contentEl.createDiv({ cls: 'mysql-table-detail-separator' });

        // Data Container without extra margins
        const dataContainer = contentEl.createDiv({ cls: 'mysql-table-detail-content' });
        const loadingMsg = dataContainer.createEl('p', { text: 'Loading data...' });
        loadingMsg.style.color = 'var(--text-muted)';

        try {
            const query = `SELECT * FROM ${this.dbName}.${tableName} LIMIT 100`;
            const result = await QueryExecutor.execute(query);

            dataContainer.empty();
            if (result.success) {
                // Render directly without the result wrapper that adds borders
                this.renderTableDataDirect(result, dataContainer, tableName);

                if (result.data && result.data[0] && result.data[0].rowCount >= 100) {
                    const note = dataContainer.createDiv({
                        text: "Showing first 100 rows only.",
                        cls: 'mysql-table-limit-note'
                    });
                }
            } else {
                dataContainer.createDiv({ text: `Error: ${result.error}`, cls: 'mysql-error-text' });
            }
        } catch (e) {
            dataContainer.empty();
            dataContainer.createDiv({ text: `Error loading data: ${e.message}`, cls: 'mysql-error-text' });
        }
    }

    private renderTableDataDirect(result: any, container: HTMLElement, tableName: string) {
        if (!result.success || !result.data || result.data.length === 0) {
            container.createEl("p", { text: "No data found", cls: "mysql-empty-state" });
            return;
        }

        const data = result.data[0];
        if (data.type === 'table' && data.data && data.data.length > 0) {
            // Create table directly without the result wrapper styling
            const tableWrapper = container.createDiv({ cls: 'mysql-direct-table-wrapper' });

            const keys = Object.keys(data.data[0]);
            const table = tableWrapper.createEl("table", { cls: "mysql-table mysql-direct-table" });

            const thead = table.createEl("thead");
            const headerRow = thead.createEl("tr");
            keys.forEach(key => headerRow.createEl("th", { text: key }));

            const tbody = table.createEl("tbody");
            const batchSize = 100;
            let currentCount = 0;

            const renderBatch = (batch: any[]) => {
                batch.forEach(row => {
                    const tr = tbody.createEl("tr");
                    keys.forEach(key => {
                        const val = row[key];
                        tr.createEl("td", {
                            text: val === null || val === undefined ? "NULL" : String(val)
                        });
                    });
                });
            };

            const initialBatch = data.data.slice(0, batchSize);
            renderBatch(initialBatch);
            currentCount += initialBatch.length;

            if (data.data.length > batchSize) {
                const controls = tableWrapper.createEl("div", { cls: "mysql-direct-pagination" });

                const statusSpan = controls.createEl("span", {
                    text: `Showing ${currentCount} of ${data.data.length} rows`,
                    cls: "mysql-pagination-status"
                });

                const showAllBtn = controls.createEl("button", {
                    text: "Show All Rows",
                    cls: "mysql-pagination-btn"
                });

                showAllBtn.onclick = () => {
                    const remaining = data.data.slice(currentCount);
                    renderBatch(remaining);
                    showAllBtn.remove();
                    statusSpan.setText(`Showing all ${data.data.length} rows`);
                };
            }
        } else {
            container.createEl("p", { text: "No table data found", cls: "mysql-empty-state" });
        }
    }

    private async copyToClipboard(data: any[]): Promise<void> {
        try {
            if (!data || data.length === 0) {
                new Notice('No data to copy');
                return;
            }

            const keys = Object.keys(data[0]);
            let textToCopy = keys.join('\t') + '\n';

            data.forEach(row => {
                const values = keys.map(k => {
                    const val = row[k];
                    return val === null || val === undefined ? '' : String(val);
                });
                textToCopy += values.join('\t') + '\n';
            });

            await navigator.clipboard.writeText(textToCopy);
            new Notice('Table data copied to clipboard!');
        } catch (error) {
            new Notice('Failed to copy: ' + error.message);
        }
    }

    private async takeScreenshot(element: HTMLElement): Promise<void> {
        try {
            // Dynamic import to avoid bundling issues
            const html2canvas = (await import('html2canvas')).default;

            const canvas = await html2canvas(element, {
                backgroundColor: getComputedStyle(element).backgroundColor || '#ffffff',
                scale: 2,
                logging: false
            });

            canvas.toBlob(async (blob: Blob | null) => {
                if (!blob) {
                    new Notice('Failed to create screenshot');
                    return;
                }

                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    new Notice('Screenshot copied to clipboard!');
                } catch (clipboardError) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `table-screenshot-${Date.now()}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                    new Notice('Screenshot downloaded!');
                }
            });
        } catch (error) {
            new Notice('Screenshot failed: ' + error.message);
            console.error('Screenshot error:', error);
        }
    }

    private async insertIntoNote(data: any[]): Promise<void> {
        try {
            const { MarkdownView } = await import('obsidian');
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

            if (!activeView) {
                new Notice('No active note found');
                return;
            }

            const editor = activeView.editor;
            const textToInsert = this.dataToMarkdownTable(data);

            const cursor = editor.getCursor();
            editor.replaceRange('\n' + textToInsert + '\n', cursor);

            const lines = textToInsert.split('\n').length;
            editor.setCursor({ line: cursor.line + lines + 1, ch: 0 });

            new Notice('Table inserted into note!');
        } catch (error) {
            new Notice('Failed to insert: ' + error.message);
        }
    }

    private async exportTableData(tableName: string, data: any[]): Promise<void> {
        try {
            if (!data || data.length === 0) {
                new Notice("Table is empty");
                return;
            }

            // Convert to CSV
            const csv = this.jsonToCSV(data);

            // Ensure export directory exists
            const exportFolder = this.plugin.settings.exportFolderName || 'sql-exports';
            if (!(await this.plugin.app.vault.adapter.exists(exportFolder))) {
                await this.plugin.app.vault.createFolder(exportFolder);
            }

            const fileName = `${exportFolder}/${tableName}_${Date.now()}.csv`;
            await this.plugin.app.vault.create(fileName, csv);

            new Notice(`Table exported to ${fileName}`);
        } catch (error) {
            console.error("CSV Export Error:", error);
            new Notice(`Export failed: ${error.message}`);
        }
    }

    private jsonToCSV(data: any[]): string {
        if (data.length === 0) return '';
        const keys = Object.keys(data[0]);
        const header = keys.join(',') + '\n';
        const rows = data.map(row =>
            keys.map(k => {
                const val = row[k];
                if (val === null || val === undefined) return '';
                const str = String(val);
                // Quote if contains comma, quote or newline
                if (str.match(/[,"]/)) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(',')
        );
        return header + rows.join('\n');
    }

    private dataToMarkdownTable(rows: any[]): string {
        if (!rows || rows.length === 0) return '_No data_';

        const keys = Object.keys(rows[0]);
        let md = '| ' + keys.join(' | ') + ' |\n';
        md += '| ' + keys.map(() => '---').join(' | ') + ' |\n';

        rows.forEach(row => {
            const values = keys.map(k => {
                const val = row[k];
                if (val === null || val === undefined) return '';
                return String(val).replace(/\|/g, '\\|');
            });
            md += '| ' + values.join(' | ') + ' |\n';
        });

        return md;
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
