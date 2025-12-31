import { App, Modal, ButtonComponent, TextComponent, Notice, setIcon, Setting } from 'obsidian';
import { IMySQLPlugin, QueryResult } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { QueryExecutor } from '../core/QueryExecutor';
import { t } from '../utils/i18n';
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
        new Setting(contentEl).setName(t('modals.switch_title')).setHeading();

        const dbs = Object.keys((alasql as { databases: Record<string, unknown> }).databases).filter(db => db !== 'alasql');
        const list = contentEl.createDiv({ cls: 'mysql-db-list' });

        if (dbs.length === 0) {
            list.createDiv({ text: t('modals.no_user_dbs'), cls: "mysql-db-list-empty" });
            return;
        }

        dbs.forEach(dbName => {
            const stats = this.plugin.dbManager.getDatabaseStats(dbName) || { tables: 0, rows: 0, sizeBytes: 0, lastUpdated: 0 };
            const isActive = dbName === this.plugin.activeDatabase;
            const isProtected = isActive || dbName === 'dbo';

            const item = list.createDiv({ cls: `mysql-db-list-item ${isActive ? 'is-active' : ''}` });

            // Info Area (Click to Switch)
            const infoArea = item.createDiv({
                cls: `mysql-db-list-content u-flex-1 ${isActive ? 'u-cursor-default' : 'u-cursor-pointer'}`
            });

            const info = infoArea.createDiv({ cls: 'mysql-db-list-info' });
            info.createDiv({ text: dbName, cls: 'mysql-db-list-name' });
            info.createDiv({
                text: `${stats.tables} ${t('modals.stat_tables').toLowerCase()} • ${stats.rows.toLocaleString()} ${t('modals.stat_rows').toLowerCase()}`,
                cls: 'mysql-db-list-meta'
            });

            if (isActive) {
                const activeBadge = item.createDiv({
                    text: t('modals.badge_ativo'),
                    cls: 'mysql-db-list-badge u-margin-left-auto'
                });
                activeBadge.setAttribute('aria-label', t('modals.tip_protected_db'));
            } else {
                if (isProtected) {
                    if (dbName === 'dbo') {
                        const dboBadge = item.createDiv({ cls: 'mysql-db-list-actions u-margin-left-auto' });
                        const lockIcon = dboBadge.createDiv({ cls: 'mysql-table-icon u-opacity-50' });
                        setIcon(lockIcon, 'lock');
                        lockIcon.setAttribute('aria-label', t('modals.tip_system_db'));
                    }
                }

                // Always allow switching if not active!
                infoArea.onclick = () => {
                    void this.switchDatabase(dbName);
                };
            }

            // Actions Area (Only for non-protected items)
            if (!isProtected) {
                const actions = item.createDiv({ cls: 'mysql-db-list-actions u-margin-left-auto' });

                const deleteBtn = actions.createEl('button', {
                    cls: 'mysql-db-list-delete-btn',
                    attr: { 'aria-label': t('modals.btn_delete') }
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
        await (alasql as { promise: (s: string) => Promise<unknown> }).promise(`USE ${dbName}`);
        this.plugin.activeDatabase = dbName;
        await this.plugin.dbManager.save();
        new Notice(t('modals.notice_switch_success', { name: dbName }));
        this.onSelect();
        this.close();
    }

    private confirmDelete(dbName: string) {
        new ConfirmationModal(
            this.app,
            t('modals.confirm_delete_title'),
            t('modals.confirm_delete_msg', { dbName }),
            (confirmed) => {
                void (async () => {
                    if (confirmed) {
                        try {
                            await this.plugin.dbManager.deleteDatabase(dbName);
                            new Notice(t('modals.notice_delete_success', { name: dbName }));
                            this.onOpen();
                        } catch (e) {
                            new Notice(t('common.error', { error: (e as Error).message }));
                        }
                    }
                })();
            },
            t('modals.btn_delete'),
            t('modals.btn_cancel')
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
        new Setting(contentEl).setName(t('modals.rename_title', { name: this.oldName })).setHeading();

        const input = new TextComponent(contentEl)
            .setPlaceholder(t('modals.rename_placeholder'))
            .setValue(this.oldName);

        input.inputEl.addClasses(['mysql-rename-input', 'u-width-full', 'u-margin-bottom-md']);

        const buttons = contentEl.createDiv({ cls: 'mysql-modal-footer' });

        new ButtonComponent(buttons)
            .setButtonText(t('modals.btn_cancel'))
            .onClick(() => this.close());

        new ButtonComponent(buttons)
            .setButtonText(t('modals.btn_renomear'))
            .setCta()
            .onClick(async () => {
                const newName = input.getValue().trim();
                if (!newName || newName === this.oldName) {
                    this.close();
                    return;
                }

                try {
                    await this.plugin.dbManager.renameDatabase(this.oldName, newName);
                    new Notice(t('modals.notice_rename_success', { name: newName }));
                    this.onSuccess();
                    this.close();
                } catch (e) {
                    new Notice(t('common.error', { error: (e as Error).message }));
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
        new Setting(contentEl).setName(t('modals.create_title')).setHeading();

        const input = new TextComponent(contentEl)
            .setPlaceholder(t('modals.create_placeholder'))
            .setValue("");

        input.inputEl.addClasses(['u-width-full', 'u-margin-bottom-md']);

        const buttons = contentEl.createDiv({ cls: 'mysql-modal-footer' });

        new ButtonComponent(buttons)
            .setButtonText(t('modals.btn_cancel'))
            .onClick(() => this.close());

        new ButtonComponent(buttons)
            .setButtonText(t('modals.btn_confirm'))
            .setCta()
            .onClick(async () => {
                const dbName = input.getValue().trim();
                if (!dbName) {
                    new Notice(t('modals.notice_create_empty'));
                    return;
                }

                try {
                    await this.plugin.dbManager.createDatabase(dbName);
                    new Notice(t('modals.notice_create_success', { name: dbName }));

                    // Automatically switch to it?
                    // Usually yes, user creates DB to use it.
                    this.plugin.activeDatabase = dbName;
                    await this.plugin.dbManager.save();
                    new Notice(t('modals.notice_switch_success', { name: dbName }));

                    this.onSuccess();
                    this.close();
                } catch (e) {
                    new Notice(t('common.error', { error: (e as Error).message }));
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
        new Setting(contentEl).setName(t('modals.duplicate_title', { name: this.oldName })).setHeading();

        const input = new TextComponent(contentEl)
            .setPlaceholder(t('modals.rename_placeholder'))
            .setValue(`${this.oldName}_copy`);

        input.inputEl.addClasses(['u-width-full', 'u-margin-bottom-md']);

        const buttons = contentEl.createDiv({ cls: 'mysql-modal-footer' });

        new ButtonComponent(buttons)
            .setButtonText(t('modals.btn_cancel'))
            .onClick(() => this.close());

        new ButtonComponent(buttons)
            .setButtonText(t('modals.btn_duplicar'))
            .setCta()
            .onClick(async () => {
                const newName = input.getValue().trim();
                if (!newName) {
                    new Notice(t('modals.notice_create_empty'));
                    return;
                }
                if (newName === this.oldName) {
                    new Notice(t('common.invalid_name'));
                    return;
                }

                try {
                    await this.plugin.dbManager.duplicateDatabase(this.oldName, newName);
                    new Notice(t('modals.notice_duplicate_success', { name: newName }));
                    this.onSuccess();
                    this.close();
                } catch (e) {
                    new Notice(t('common.error', { error: (e as Error).message }));
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
        new Setting(contentEl).setName(t('modals.tables_title', { name: this.dbName })).setHeading();

        const db = (alasql as { databases: Record<string, { tables: Record<string, { data: unknown[] }> }> }).databases[this.dbName];
        if (!db || !db.tables || Object.keys(db.tables).length === 0) {
            contentEl.createDiv({ text: t('renderer.msg_no_tables'), cls: "mysql-empty-state" });
            return;
        }

        const list = contentEl.createDiv({ cls: 'mysql-table-list' });
        const tables = Object.keys(db.tables);

        tables.forEach(tableName => {
            const tableData = db.tables[tableName].data || [];
            const rowCount = tableData.length;
            const sizeEstimate = JSON.stringify(tableData).length;

            const item = list.createDiv({
                cls: 'mysql-table-list-item u-cursor-pointer'
            });

            // Icon
            const iconDiv = item.createDiv({ cls: 'mysql-table-icon' });
            setIcon(iconDiv, "table");

            // Info
            const info = item.createDiv({ cls: 'mysql-table-info' });
            info.createDiv({ text: tableName, cls: 'mysql-table-name' });
            info.createDiv({
                text: `${rowCount} ${t('modals.stat_rows').toLowerCase()} • ~${this.formatBytes(sizeEstimate)}`,
                cls: 'mysql-table-meta'
            });

            // Drill-down on click
            item.onclick = () => {
                void this.showTableData(tableName);
            };
        });
    }

    private async showTableData(tableName: string) {
        const { contentEl } = this;
        contentEl.empty();

        // Header with improved button layout
        const header = contentEl.createDiv({ cls: 'mysql-table-detail-header' });

        const left = header.createDiv({ cls: 'mysql-table-detail-title u-display-flex u-align-center u-gap-sm' });

        new ButtonComponent(left)
            .setIcon('arrow-left')
            .setTooltip(t('renderer.tip_back'))
            .onClick(() => this.renderList());

        new Setting(left).setName(tableName).setHeading();

        // Actions on the right with better spacing
        const actions = header.createDiv({ cls: 'mysql-table-detail-actions u-display-flex u-gap-sm' });

        // Copy button
        new ButtonComponent(actions)
            .setIcon("copy")
            .setTooltip(t('renderer.tip_copy'))
            .onClick(async () => {
                try {
                    const query = `SELECT * FROM ${this.dbName}.${tableName}`;
                    const result = await QueryExecutor.execute(query);

                    if (result.success && result.data && result.data[0] && result.data[0].data) {
                        await this.copyToClipboard(result.data[0].data as unknown[]);
                    } else {
                        new Notice(t('renderer.notice_copy_failed', { error: t('renderer.msg_no_data') }));
                    }
                } catch (e) {
                    new Notice(t('modals.notice_copy_failed', { error: (e as Error).message }));
                }
            });

        // Screenshot button
        new ButtonComponent(actions)
            .setIcon("camera")
            .setTooltip(t('renderer.tip_screenshot'))
            .onClick(async () => {
                try {
                    const tableElement = dataContainer.querySelector('.mysql-direct-table-wrapper');
                    if (tableElement) {
                        await this.takeScreenshot(tableElement as HTMLElement);
                    } else {
                        new Notice(t('renderer.notice_screenshot_failed', { error: 'No table element' }));
                    }
                } catch (e) {
                    new Notice(t('renderer.notice_screenshot_failed', { error: (e as Error).message }));
                }
            });

        // Add to note button
        new ButtonComponent(actions)
            .setIcon("file-plus")
            .setTooltip(t('renderer.tip_add_note'))
            .onClick(async () => {
                try {
                    const query = `SELECT * FROM ${this.dbName}.${tableName}`;
                    const result = await QueryExecutor.execute(query);

                    if (result.success && result.data && result.data[0] && result.data[0].data) {
                        await this.insertIntoNote(result.data[0].data as unknown[]);
                    } else {
                        new Notice(t('renderer.notice_insert_failed', { error: t('renderer.msg_no_data') }));
                    }
                } catch (e) {
                    new Notice(t('renderer.notice_insert_failed', { error: (e as Error).message }));
                }
            });

        // Export button with correct icon
        new ButtonComponent(actions)
            .setIcon("download")
            .setTooltip(t('modals.btn_exportar'))
            .onClick(async () => {
                try {
                    // Get the table data and export manually since CSVManager doesn't handle database context
                    const query = `SELECT * FROM ${this.dbName}.${tableName}`;
                    const result = await QueryExecutor.execute(query);

                    if (result.success && result.data && result.data[0] && result.data[0].data) {
                        await this.exportTableData(tableName, result.data[0].data as unknown[]);
                    } else {
                        new Notice(t('renderer.msg_no_data'));
                    }
                } catch (e) {
                    new Notice(t('common.error', { error: (e as Error).message }));
                }
            });

        // Close button
        new ButtonComponent(actions)
            .setIcon('x')
            .setTooltip(t('workbench.btn_cancel'))
            .onClick(() => this.close());

        // Separator line
        contentEl.createDiv({ cls: 'mysql-table-detail-separator' });

        // Data Container without extra margins
        const dataContainer = contentEl.createDiv({ cls: 'mysql-table-detail-content' });
        dataContainer.createEl('p', {
            text: t('renderer.msg_loading'),
            cls: 'u-text-muted'
        });

        try {
            const query = `SELECT * FROM ${this.dbName}.${tableName} LIMIT 100`;
            const result = await QueryExecutor.execute(query);

            dataContainer.empty();
            if (result.success) {
                // Render directly without the result wrapper that adds borders
                this.renderTableDataDirect(result, dataContainer, tableName);

                if (result.data && result.data[0] && (result.data[0].rowCount ?? 0) >= 100) {
                    dataContainer.createDiv({
                        text: t('renderer.msg_showing_limit', { count: '100' }),
                        cls: 'mysql-table-limit-note'
                    });
                }
            } else {
                dataContainer.createDiv({ text: `Error: ${result.error}`, cls: 'mysql-error-text' });
            }
        } catch (e) {
            dataContainer.empty();
            dataContainer.createDiv({ text: `Error loading data: ${(e as Error).message}`, cls: 'mysql-error-text' });
        }
    }

    private renderTableDataDirect(result: QueryResult, container: HTMLElement, tableName: string) {
        if (!result.success || !result.data || result.data.length === 0) {
            container.createEl("p", { text: t('renderer.msg_no_data'), cls: "mysql-empty-state" });
            return;
        }

        const data = result.data[0];
        if (data.type === 'table' && Array.isArray(data.data) && data.data.length > 0) {
            const rows = data.data as unknown[];
            // Create table directly without the result wrapper styling
            const tableWrapper = container.createDiv({ cls: 'mysql-direct-table-wrapper' });

            const keys = Object.keys(rows[0] as Record<string, unknown>);
            const table = tableWrapper.createEl("table", { cls: "mysql-table mysql-direct-table" });

            const thead = table.createEl("thead");
            const headerRow = thead.createEl("tr");
            keys.forEach(key => headerRow.createEl("th", { text: key }));

            const tbody = table.createEl("tbody");
            const batchSize = 100;
            let currentCount = 0;

            const renderBatch = (batch: unknown[]) => {
                batch.forEach(row => {
                    const rowData = row as Record<string, unknown>;
                    const tr = tbody.createEl("tr");
                    keys.forEach(key => {
                        const val = rowData[key];
                        const stringVal = (val !== null && typeof val === 'object') ? JSON.stringify(val) : String(val as string | number | boolean);
                        tr.createEl("td", {
                            text: val === null || val === undefined ? t('modals.null_value') : stringVal
                        });
                    });
                });
            };

            const initialBatch = rows.slice(0, batchSize);
            renderBatch(initialBatch);
            currentCount += initialBatch.length;

            if (rows.length > batchSize) {
                const controls = tableWrapper.createEl("div", { cls: "mysql-direct-pagination" });

                const statusSpan = controls.createEl("span", {
                    text: t('renderer.msg_showing_rows', { count: String(currentCount), total: String(rows.length) }),
                    cls: "mysql-pagination-status"
                });

                const showAllBtn = controls.createEl("button", {
                    text: t('renderer.btn_show_all'),
                    cls: "mysql-pagination-btn"
                });

                showAllBtn.onclick = () => {
                    const remaining = rows.slice(currentCount);
                    renderBatch(remaining);
                    showAllBtn.remove();
                    statusSpan.setText(t('renderer.msg_showing_all', { count: String(rows.length) }));
                };
            }
        } else {
            container.createEl("p", { text: t('renderer.msg_no_data'), cls: "mysql-empty-state" });
        }
    }

    private async copyToClipboard(data: unknown[]): Promise<void> {
        try {
            if (!data || data.length === 0) {
                new Notice(t('renderer.msg_no_data'));
                return;
            }

            const keys = Object.keys(data[0]);
            let textToCopy = keys.join('\t') + '\n';

            data.forEach(row => {
                const values = keys.map(k => {
                    const val = (row as Record<string, unknown>)[k];
                    if (val === null || val === undefined) return '';
                    if (typeof val === 'object') return JSON.stringify(val);
                    return String(val as string | number | boolean);
                });
                textToCopy += values.join('\t') + '\n';
            });

            await navigator.clipboard.writeText(textToCopy);
            new Notice(t('modals.notice_table_data_copied'));
        } catch (error) {
            new Notice(t('modals.notice_copy_failed', { error: (error as Error).message }));
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

            canvas.toBlob((blob: Blob | null) => {
                void (async () => {
                    if (!blob) {
                        new Notice(t('modals.notice_screenshot_failed', { error: 'Blob creation failed' }));
                        return;
                    }

                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        new Notice(t('renderer.notice_screenshot_copied'));
                    } catch {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `table-screenshot-${Date.now()}.png`;
                        a.click();
                        URL.revokeObjectURL(url);
                        new Notice(t('renderer.notice_screenshot_downloaded'));
                    }
                })();
            });
        } catch (error) {
            new Notice(t('renderer.notice_screenshot_failed', { error: (error as Error).message }));
            console.error('Screenshot error:', error);
        }
    }

    private async insertIntoNote(data: unknown[]): Promise<void> {
        try {
            const { MarkdownView } = await import('obsidian');
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

            if (!activeView) {
                new Notice(t('modals.notice_no_active_note'));
                return;
            }

            const editor = activeView.editor;
            const textToInsert = this.dataToMarkdownTable(data);

            const cursor = editor.getCursor();
            editor.replaceRange('\n' + textToInsert + '\n', cursor);

            const lines = textToInsert.split('\n').length;
            editor.setCursor({ line: cursor.line + lines + 1, ch: 0 });

            new Notice(t('modals.notice_table_inserted'));
        } catch (error) {
            new Notice(t('modals.notice_insert_failed', { error: (error as Error).message }));
        }
    }

    private async exportTableData(tableName: string, data: unknown[]): Promise<void> {
        try {
            if (!data || data.length === 0) {
                new Notice(t('renderer.msg_no_data'));
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

            new Notice(t('common.notice_export_success', { name: fileName }));
        } catch (error) {
            console.error("CSV Export Error:", error);
            new Notice(t('common.error', { error: (error as Error).message }));
        }
    }

    private jsonToCSV(data: unknown[]): string {
        if (data.length === 0) return '';
        const keys = Object.keys(data[0] as Record<string, unknown>);
        const header = keys.join(',') + '\n';
        const rows = data.map(row => {
            const rowData = row as Record<string, unknown>;
            return keys.map(k => {
                const val = rowData[k];
                if (val === null || val === undefined) return '';
                const str = (typeof val === 'object') ? JSON.stringify(val) : String(val as string | number | boolean);
                // Quote if contains comma, quote or newline
                if (str.match(/[,"]/)) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(',');
        });
        return header + rows.join('\n');
    }

    private dataToMarkdownTable(rows: unknown[]): string {
        if (!rows || rows.length === 0) return '_No data_';

        const keys = Object.keys(rows[0] as Record<string, unknown>);
        let md = '| ' + keys.join(' | ') + ' |\n';
        md += '| ' + keys.map(() => '---').join(' | ') + ' |\n';

        rows.forEach(row => {
            const rowData = row as Record<string, unknown>;
            const values = keys.map(k => {
                const val = rowData[k];
                if (val === null || val === undefined) return '';
                const stringVal = (typeof val === 'object') ? JSON.stringify(val) : String(val as string | number | boolean);
                return stringVal.replace(/\|/g, '\\|');
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
