import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { IMySQLPlugin } from './types';
import { ConfirmationModal } from './ui/ConfirmationModal';

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


        // --- Appearance Section ---
        containerEl.createEl('h3', { text: 'Appearance' });

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
        containerEl.createEl('h3', { text: 'General' });

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
        containerEl.createEl('h3', { text: 'Data & Security' });

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
}
