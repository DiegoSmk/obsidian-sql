import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { IMySQLPlugin } from './types';

export class MySQLSettingTab extends PluginSettingTab {
    plugin: IMySQLPlugin;

    constructor(app: App, plugin: IMySQLPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'MySQL Plugin Settings' });

        new Setting(containerEl)
            .setName('Auto-save')
            .setDesc('Automatically save database changes')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSave)
                .onChange(async (value) => {
                    this.plugin.settings.autoSave = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto-save delay')
            .setDesc('Delay in milliseconds before auto-saving (default: 2000)')
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
            .setName('Batch size')
            .setDesc('Number of rows to display per batch (default: 100)')
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
            .setName('Export folder')
            .setDesc('Folder for CSV exports')
            .addText(text => text
                .setPlaceholder('sql-exports')
                .setValue(this.plugin.settings.exportFolderName)
                .onChange(async (value) => {
                    this.plugin.settings.exportFolderName = value || 'sql-exports';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Safe Mode')
            .setDesc('Block dangerous commands (DROP, ALTER, etc) and enforce limits')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.safeMode)
                .onChange(async (value) => {
                    this.plugin.settings.safeMode = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Snapshot Row Limit')
            .setDesc('Max rows per table to save in snapshot (avoid memory crash)')
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
            .setName('Reset all data')
            .setDesc('⚠️ DANGER: Delete all databases and tables')
            .addButton(btn => btn
                .setWarning()
                .setButtonText('Reset Everything')
                .onClick(async () => {
                    if (!confirm('Are you ABSOLUTELY sure? This cannot be undone!')) return;
                    // Access dbManager dynamically or cast plugin
                    const dbManager = (this.plugin as any).dbManager;
                    if (dbManager) {
                        await dbManager.reset();
                        new Notice('All data reset');
                        this.display();
                    } else {
                        new Notice('Database Manager not available');
                    }
                }));
    }
}
