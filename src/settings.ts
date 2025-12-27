import { App, PluginSettingTab, Setting, Notice, setIcon, ButtonComponent } from 'obsidian';
// @ts-ignore
import alasql from 'alasql';
import { IMySQLPlugin } from './types';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { DatabaseSwitcherModal, RenameDatabaseModal, DatabaseTablesModal } from './ui/DatabaseModals';

export class MySQLSettingTab extends PluginSettingTab {
    plugin: IMySQLPlugin;

    constructor(app: App, plugin: IMySQLPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('mysql-settings-modal');

        // --- Header with Logo ---
        const header = containerEl.createDiv({ cls: 'mysql-settings-header' });
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.marginBottom = '20px';
        header.style.gap = '10px';

        const logo = header.createDiv({ cls: 'mysql-logo' });
        logo.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 12C20 14.2091 16.4183 16 12 16C7.58172 16 4 14.2091 4 12M20 12V18C20 20.2091 16.4183 22 12 22C7.58172 22 4 20.2091 4 18V12M20 12C20 9.79086 16.4183 8 12 8C7.58172 8 4 9.79086 4 12M20 6C20 8.20914 16.4183 10 12 10C7.58172 10 4 8.20914 4 6C4 3.79086 7.58172 2 12 2C16.4183 2 20 3.79086 20 6Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        logo.style.color = 'var(--text-accent)';

        const title = header.createEl('h2', { text: 'SQL Notebook' });
        title.style.margin = '0';

        // --- Database Management Section (Now at Top) ---
        this.createSectionHeader(containerEl, 'Database Management', 'database');
        this.renderActiveDatabaseCard(containerEl);

        // --- Appearance Section ---
        this.createSectionHeader(containerEl, 'Appearance', 'palette');

        const colors = [
            { name: 'Purple (Default)', value: '#9d7cd8' },
            { name: 'Blue', value: '#61afef' },
            { name: 'Green', value: '#98c379' },
            { name: 'Orange', value: '#e5c07b' },
            { name: 'Red', value: '#e06c75' },
        ];

        new Setting(containerEl)
            .setName('Theme Accent')
            .setDesc('Choose the primary accent color for the workbench.')
            .addText(text => {
                text.inputEl.style.display = 'none'; // Hidden input to store value if needed logically
            })
            .then((setting) => {
                const colorContainer = setting.controlEl.createDiv({ cls: 'mysql-color-picker' });
                colorContainer.style.display = 'flex';
                colorContainer.style.gap = '10px';

                colors.forEach(c => {
                    const circle = colorContainer.createDiv({ cls: 'mysql-color-circle' });
                    circle.style.backgroundColor = c.value;
                    circle.style.width = '24px';
                    circle.style.height = '24px';
                    circle.style.borderRadius = '50%';
                    circle.style.cursor = 'pointer';
                    circle.style.border = this.plugin.settings.themeColor === c.value
                        ? '2px solid var(--text-normal)'
                        : '2px solid transparent';

                    circle.title = c.name;

                    circle.onClickEvent(async () => {
                        this.plugin.settings.themeColor = c.value;
                        await this.plugin.saveSettings(); // This triggers applyTheme()

                        // Update UI selection immediately
                        const allCircles = colorContainer.querySelectorAll('.mysql-color-circle');
                        allCircles.forEach((el: HTMLElement) => el.style.border = '2px solid transparent');
                        circle.style.border = '2px solid var(--text-normal)';
                    });
                });
            });

        // --- General Section ---
        this.createSectionHeader(containerEl, 'General', 'sliders');

        new Setting(containerEl)
            .setName('Auto-save')
            .setDesc('Automatically save database changes.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSave)
                .onChange(async (value) => {
                    this.plugin.settings.autoSave = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto-save Delay')
            .setDesc('Milliseconds to wait before auto-saving.')
            .addText(text => text
                .setPlaceholder('2000')
                .setValue(String(this.plugin.settings.autoSaveDelay))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.autoSaveDelay = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Export Folder')
            .setDesc('Default folder for CSV exports.')
            .addText(text => text
                .setPlaceholder('sql-exports')
                .setValue(this.plugin.settings.exportFolderName)
                .onChange(async (value) => {
                    this.plugin.settings.exportFolderName = value || 'sql-exports';
                    await this.plugin.saveSettings();
                }));

        // --- Data & Security Section ---
        this.createSectionHeader(containerEl, 'Data & Security', 'shield');

        new Setting(containerEl)
            .setName('Safe Mode')
            .setDesc('Block dangerous commands (DROP, ALTER) and enforce limits.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.safeMode)
                .onChange(async (value) => {
                    this.plugin.settings.safeMode = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Snapshot Row Limit')
            .setDesc('Max rows per table to save (prevents memory issues).')
            .addText(text => text
                .setPlaceholder('10000')
                .setValue(String(this.plugin.settings.snapshotRowLimit))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.snapshotRowLimit = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Batch Size')
            .setDesc('Rows to display per page in results.')
            .addText(text => text
                .setPlaceholder('100')
                .setValue(String(this.plugin.settings.batchSize))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.batchSize = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Reset All Data')
            .setDesc('Deletes all databases and resets settings.')
            .addButton(btn => {
                btn.setButtonText('Reset Everything');
                btn.setWarning();
                btn.setIcon('trash-2'); // Using explicit Lucide icon
                btn.onClick(() => {
                    new ConfirmationModal(
                        this.app,
                        "Reset All Data",
                        "Are you ABSOLUTELY sure? This will delete all databases, tables, and reset your settings. This action cannot be undone.",
                        async (confirmed) => {
                            if (confirmed) {
                                const dbManager = (this.plugin as any).dbManager;
                                if (dbManager) {
                                    await dbManager.reset();
                                    new Notice('All data has been reset.');
                                    this.display(); // Refresh UI
                                } else {
                                    new Notice('Database Manager unavailable.');
                                }
                            }
                        },
                        "Reset Everything",
                        "Cancel"
                    ).open();
                });
            });
    }

    private createSectionHeader(container: HTMLElement, text: string, icon: string) {
        const header = container.createDiv({ cls: 'mysql-settings-section-header' });
        setIcon(header.createDiv({ cls: 'mysql-section-icon' }), icon);
        header.createEl('h3', { text });
    }

    private renderActiveDatabaseCard(containerEl: HTMLElement): void {
        const activeDB = this.plugin.activeDatabase;
        const dbManager = (this.plugin as any).dbManager;
        const stats = dbManager.getDatabaseStats(activeDB);

        // Calculate total databases (excluding alasql system DB)
        // @ts-ignore
        const totalDBs = Object.keys(alasql.databases).filter(d => d !== 'alasql').length;

        const card = containerEl.createDiv({ cls: 'mysql-db-card' });

        // Header
        const header = card.createDiv({ cls: 'mysql-db-card-header' });

        // Title Row
        const titleRow = header.createDiv({ cls: 'mysql-db-card-title-row' });
        setIcon(titleRow.createDiv({ cls: 'mysql-db-card-icon' }), "database");
        titleRow.createEl('span', { text: activeDB, cls: 'mysql-db-card-name' });

        // System Badge
        if (activeDB === 'alasql') {
            titleRow.createEl('span', { text: 'SYSTEM', cls: 'mysql-db-system-badge' });
        }

        // Database Count Badge (Right Aligned)
        const countBadge = header.createDiv({ cls: 'mysql-db-count-badge' });
        countBadge.createSpan({ text: `${totalDBs} Databases` });

        // Stats Grid
        const statsGrid = card.createDiv({ cls: 'mysql-db-stats-grid' });
        this.addStat(statsGrid, "Tables", stats.tables.toString(), "table");
        this.addStat(statsGrid, "Rows", stats.rows.toLocaleString(), "list");
        this.addStat(statsGrid, "Size", this.formatBytes(stats.sizeBytes), "hard-drive");

        const lastMod = containerEl.createDiv({
            text: `Last updated: ${this.timeAgo(stats.lastUpdated)}`,
            cls: 'mysql-db-card-last-updated'
        });

        // Footer / Actions
        const actions = card.createDiv({ cls: 'mysql-db-card-actions' });

        // Primary Actions
        new ButtonComponent(actions)
            .setButtonText("Switch")
            .onClick(() => this.openSwitcherModal());

        const renameBtn = new ButtonComponent(actions)
            .setButtonText("Rename")
            .onClick(() => this.openRenameModal());

        if (activeDB === 'dbo') {
            renameBtn.setDisabled(true);
            renameBtn.setTooltip("Default database cannot be renamed");
            renameBtn.buttonEl.classList.add('is-disabled-explicit');
        }

        // New: View Tables
        new ButtonComponent(actions)
            .setButtonText("Tables")
            .setIcon("table")
            .onClick(() => this.openTablesModal());

        // Secondary / Destructive
        const separator = actions.createDiv({ cls: 'mysql-action-separator' }); // CSS to push items to right if flex-grow

        new ButtonComponent(actions)
            .setButtonText("Clear")
            .setWarning()
            .onClick(() => this.openClearConfirm());

        // Delete button removed from here as per v0.3.8 requirements
    }

    private addStat(parent: HTMLElement, label: string, value: string, iconName?: string): void {
        const item = parent.createDiv({ cls: 'mysql-db-stat-item' });
        if (iconName) {
            const icon = item.createDiv({ cls: 'mysql-db-stat-icon' });
            setIcon(icon, iconName);
        }
        item.createDiv({ text: label, cls: 'mysql-db-stat-label' });
        item.createDiv({ text: value, cls: 'mysql-db-stat-value' });
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    private timeAgo(timestamp: number): string {
        if (!timestamp) return "Never";
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return "Just now";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} min ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    private openSwitcherModal(): void {
        const modal = new DatabaseSwitcherModal(this.app, this.plugin, () => this.display());
        modal.open();
    }

    private openRenameModal(): void {
        const modal = new RenameDatabaseModal(this.app, this.plugin, this.plugin.activeDatabase, () => this.display());
        modal.open();
    }

    private openTablesModal(): void {
        const modal = new DatabaseTablesModal(this.app, this.plugin, this.plugin.activeDatabase);
        modal.open();
    }

    private openClearConfirm(): void {
        const activeDB = this.plugin.activeDatabase;
        new ConfirmationModal(
            this.app,
            "Clear Database",
            `Are you sure you want to clear all tables in "${activeDB}"? This keeps the database but deletes all data.`,
            async (confirmed) => {
                if (confirmed) {
                    await (this.plugin as any).dbManager.clearDatabase(activeDB);
                    new Notice(`Database "${activeDB}" cleared.`);
                    this.display();
                }
            },
            "Clear all data",
            "Cancel"
        ).open();
    }

    private confirmDelete(dbName: string): void {
        new ConfirmationModal(
            this.app,
            "Delete Database",
            `You are about to delete database "${dbName}". This action cannot be undone. All tables and data will be lost.`,
            async (confirmed) => {
                if (confirmed) {
                    try {
                        const dbManager = (this.plugin as any).dbManager;
                        await dbManager.deleteDatabase(dbName);
                        new Notice(`Database "${dbName}" deleted.`);
                        this.display();
                    } catch (e) {
                        new Notice(`Error: ${e.message}`);
                    }
                }
            },
            "Delete Database",
            "Cancel"
        ).open();
    }
}
