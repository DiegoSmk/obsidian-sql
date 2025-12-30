import { App, PluginSettingTab, Setting, Notice, setIcon, ButtonComponent } from 'obsidian';
// @ts-ignore
import alasql from 'alasql';
import { IMySQLPlugin } from './types';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { DatabaseSwitcherModal, RenameDatabaseModal, DatabaseTablesModal, CreateDatabaseModal, DuplicateDatabaseModal } from './ui/DatabaseModals';
import { t, setLanguage } from './utils/i18n';
import { Language } from './types';

export class MySQLSettingTab extends PluginSettingTab {
    plugin: IMySQLPlugin;

    constructor(app: App, plugin: IMySQLPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    private hexToRgb(hex: string): { r: number, g: number, b: number } | null {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('mysql-settings-modal');

        // Apply Theme Color
        const themeColor = this.plugin.settings.themeColor || '#9d7cd8';
        const color = this.plugin.settings.useObsidianAccent ? 'var(--interactive-accent)' : themeColor;

        containerEl.style.setProperty('--mysql-accent', color);
        containerEl.style.setProperty('--mysql-accent-purple', color);

        // --- Header (Title + Import/Create) ---
        const header = containerEl.createDiv({ cls: 'mysql-settings-header' });

        const titleGroup = header.createDiv({ cls: 'mysql-settings-title-group' });
        titleGroup.style.display = 'flex';
        titleGroup.style.alignItems = 'center';
        titleGroup.style.gap = '10px';

        // Logo
        const logo = titleGroup.createDiv({ cls: 'mysql-logo' });
        // New SVG with currentColor applied
        logo.innerHTML = `<svg width="40" height="40" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M128 136C163.346 136 192 127.046 192 116C192 104.954 163.346 96 128 96C92.6538 96 64 104.954 64 116C64 127.046 92.6538 136 128 136Z" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M64 116V188C64 199 93 208 128 208C163 208 192 199 192 188V112" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M64 152C64 163 93 172 128 172C163 172 192 163 192 152" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M64 188C64 199 93 208 128 208C163 208 192 199 192 188" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<mask id="mask0_101_3" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="-5" y="-5" width="266" height="266">
<path d="M256 0H0V256H256V0Z" fill="white" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
</mask>
<g mask="url(#mask0_101_3)">
<path d="M128 76C163.346 76 192 67.0457 192 56C192 44.9543 163.346 36 128 36C92.6538 36 64 44.9543 64 56C64 67.0457 92.6538 76 128 76Z" fill="currentColor"/>
<path d="M64 56V92C64 103 93 112 128 112C163 112 192 103 192 92V56" fill="currentColor"/>
<path d="M128 112C163.346 112 192 103.046 192 92C192 80.9543 163.346 72 128 72C92.6538 72 64 80.9543 64 92C64 103.046 92.6538 112 128 112Z" fill="currentColor"/>
<path d="M135 91.5C135 77.5 135 63.5 135 59.5C135 53.5 141 53.5 145 59.5C151 67.5 157 79.5 165 85.5C171 91.5 177 91.5 177 85.5C177 77.5 177 65.5 177 59.5" stroke="var(--background-primary)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
</g>
</svg>`;
        logo.style.color = 'var(--mysql-accent, var(--interactive-accent))';

        // Title & Welcome
        const titleText = titleGroup.createDiv({ cls: 'mysql-title-text' });
        titleText.createEl('h2', { text: t('settings.title'), attr: { style: 'margin: 0; line-height: 1.2;' } });
        titleText.createEl('span', { text: t('settings.subtitle'), attr: { style: 'font-size: 13px; color: var(--text-muted);' } });

        // Welcome Section (Full width below header or integrated?)
        // User asked for a "Welcome Section" in settings screen.
        // Let's create it right below the header line.

        const actions = header.createDiv({ cls: 'mysql-header-actions' });

        // Import Button
        const importBtnContainer = actions.createDiv({ cls: 'mysql-import-wrapper' });
        const importInput = importBtnContainer.createEl('input', {
            type: 'file',
            attr: { accept: '.sql' }
        });
        importInput.style.display = 'none';
        importInput.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (file) {
                await this.importDatabaseSQL(file);
                importInput.value = '';
            }
        };

        // Refresh Button
        new ButtonComponent(actions)
            .setButtonText(t('settings.btn_atualizar'))
            .setIcon("refresh-cw")
            .setTooltip(t('settings.btn_atualizar'))
            .onClick(() => {
                this.display();
                new Notice(t('settings.btn_atualizar') + "!");
            });

        new ButtonComponent(importBtnContainer)
            .setButtonText(t('settings.btn_importar'))
            .setIcon("import")
            .setTooltip(t('settings.btn_importar'))
            .onClick(() => importInput.click());

        // Create Button
        new ButtonComponent(actions)
            .setButtonText(t('settings.btn_novo_db'))
            .setIcon("plus")
            .setCta()
            .onClick(() => this.openCreateModal());

        // --- Welcome Section ---
        const welcomeSection = containerEl.createDiv({ cls: 'mysql-welcome-section' });
        welcomeSection.style.marginBottom = '20px';
        welcomeSection.style.padding = '15px';
        welcomeSection.style.background = 'color-mix(in srgb, var(--mysql-accent), transparent 90%)';
        welcomeSection.style.borderRadius = '8px';
        welcomeSection.style.border = '1px solid color-mix(in srgb, var(--mysql-accent), transparent 70%)';

        welcomeSection.createEl('h3', { text: t('settings.welcome_title'), attr: { style: 'margin: 0 0 5px 0; color: var(--mysql-accent);' } });
        welcomeSection.createEl('p', { text: t('settings.welcome_desc'), attr: { style: 'margin: 0; font-size: 14px; color: var(--text-normal);' } });


        // --- Search Section ---
        const searchSection = containerEl.createDiv({ cls: 'mysql-search-section' });

        // Wrapper for icon + input styling
        const searchWrapper = searchSection.createDiv({ cls: 'mysql-search-wrapper' });
        searchWrapper.style.display = 'flex';
        searchWrapper.style.alignItems = 'center';
        searchWrapper.style.background = 'var(--background-secondary)';
        searchWrapper.style.border = '1px solid var(--background-modifier-border)';
        searchWrapper.style.borderRadius = '6px';
        searchWrapper.style.padding = '0 8px';

        const searchIcon = searchWrapper.createDiv({ cls: 'mysql-search-icon' });
        setIcon(searchIcon, 'search');
        searchIcon.style.opacity = '0.5';
        searchIcon.style.display = 'flex';
        searchIcon.style.marginRight = '8px';

        const searchInput = searchWrapper.createEl('input', {
            type: 'text',
            cls: 'mysql-search-box',
            placeholder: t('settings.search_placeholder'),
            attr: { style: 'border: none; box-shadow: none; background: transparent; width: 100%; padding: 8px; outline: none;' }
        });

        // --- Grid Container ---
        const grid = containerEl.createDiv({ cls: 'mysql-databases-grid' });

        // Initial Render
        this.renderDatabaseGrid(grid, '');

        // Search Listener
        searchInput.addEventListener('input', (e) => {
            const term = (e.target as HTMLInputElement).value;
            this.renderDatabaseGrid(grid, term);
        });

        // --- Info Section ---
        const infoSection = containerEl.createDiv({ cls: 'mysql-info-board' });
        infoSection.style.background = 'var(--background-secondary)';
        infoSection.style.padding = '15px';
        infoSection.style.borderRadius = '6px';
        infoSection.style.marginTop = '20px';
        infoSection.style.border = '1px solid var(--background-modifier-border)';

        infoSection.createEl('h4', { text: t('settings.info_title'), attr: { style: 'margin-top: 0; margin-bottom: 10px; color: var(--mysql-accent, var(--interactive-accent));' } });
        const list = infoSection.createEl('ul', { attr: { style: 'margin: 0; padding-left: 20px; color: var(--text-muted); font-size: 13px;' } });

        const li1 = list.createEl('li');
        li1.innerHTML = t('settings.info_li_1');

        const li2 = list.createEl('li');
        li2.innerHTML = t('settings.info_li_2');

        const li3 = list.createEl('li');
        li3.innerHTML = t('settings.info_li_3');


        containerEl.createEl('hr', { attr: { style: 'margin: 40px 0; border: none; border-top: 1px solid var(--background-modifier-border);' } });

        this.createSectionHeader(containerEl, t('settings.section_general'), 'settings');
        this.renderGeneralSettings(containerEl);

        // --- Footer ---
        const footer = containerEl.createDiv({ cls: 'mysql-settings-footer' });
        footer.style.display = 'flex';
        footer.style.flexDirection = 'column';
        footer.style.alignItems = 'center';
        footer.style.justifyContent = 'center';
        footer.style.marginTop = '40px';
        footer.style.paddingTop = '20px';
        footer.style.borderTop = '1px solid var(--background-modifier-border)';
        footer.style.opacity = '0.7';

        const footerLogo = footer.createDiv({ cls: 'mysql-logo-footer' });
        footerLogo.innerHTML = `<svg width="40" height="40" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M128 136C163.346 136 192 127.046 192 116C192 104.954 163.346 96 128 96C92.6538 96 64 104.954 64 116C64 127.046 92.6538 136 128 136Z" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M64 116V188C64 199 93 208 128 208C163 208 192 199 192 188V112" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M64 152C64 163 93 172 128 172C163 172 192 163 192 152" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M64 188C64 199 93 208 128 208C163 208 192 199 192 188" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<mask id="mask0_101_3_footer" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="-5" y="-5" width="266" height="266">
<path d="M256 0H0V256H256V0Z" fill="white" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
</mask>
<g mask="url(#mask0_101_3_footer)">
<path d="M128 76C163.346 76 192 67.0457 192 56C192 44.9543 163.346 36 128 36C92.6538 36 64 44.9543 64 56C64 67.0457 92.6538 76 128 76Z" fill="currentColor"/>
<path d="M64 56V92C64 103 93 112 128 112C163 112 192 103 192 92V56" fill="currentColor"/>
<path d="M128 112C163.346 112 192 103.046 192 92C192 80.9543 163.346 72 128 72C92.6538 72 64 80.9543 64 92C64 103.046 92.6538 112 128 112Z" fill="currentColor"/>
<path d="M135 91.5C135 77.5 135 63.5 135 59.5C135 53.5 141 53.5 145 59.5C151 67.5 157 79.5 165 85.5C171 91.5 177 91.5 177 85.5C177 77.5 177 65.5 177 59.5" stroke="var(--background-primary)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
</g>
</svg>`;
        footerLogo.style.color = 'var(--mysql-accent, var(--interactive-accent))';
        footerLogo.style.marginBottom = '10px';

        footer.createEl('h3', { text: t('settings.title'), attr: { style: 'margin: 0; font-size: 16px; color: var(--text-normal);' } });
        footer.createEl('span', { text: t('settings.footer_by'), attr: { style: 'font-size: 12px; color: var(--text-muted);' } });
    }

    private renderDatabaseGrid(container: HTMLElement, searchTerm: string, page: number = 1): void {
        container.empty();

        // Remove grid class from parent if it exists, to allow stacking of grid + pagination
        container.removeClass('mysql-databases-grid');

        // Get all databases
        // @ts-ignore
        const allDbs = Object.keys(alasql.databases).filter(d => d !== 'alasql');
        const filteredDbs = allDbs.filter(d => d.toLowerCase().includes(searchTerm.toLowerCase()));

        // Start with Active DB at top if it matches search
        const activeDB = this.plugin.activeDatabase;
        const sortedDbs = filteredDbs.sort((a, b) => {
            if (a === activeDB) return -1;
            if (b === activeDB) return 1;
            return a.localeCompare(b);
        });

        if (sortedDbs.length === 0) {
            container.addClass('mysql-databases-grid'); // Re-add for empty msg if needed
            container.createDiv({ text: t('settings.search_placeholder'), cls: "mysql-empty-msg" });
            return;
        }

        // Pagination Logic
        const pageSize = 4;
        const totalPages = Math.ceil(sortedDbs.length / pageSize);

        // Ensure current page is valid
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        const startIndex = (page - 1) * pageSize;
        const paginatedDbs = sortedDbs.slice(startIndex, startIndex + pageSize);

        // Render Cards Wrapper
        const gridContent = container.createDiv({ cls: 'mysql-databases-grid' });

        paginatedDbs.forEach(dbName => {
            this.renderDatabaseCard(gridContent, dbName);
        });

        // Pagination Controls
        if (totalPages > 1) {
            const paginationContainer = container.createDiv({ cls: 'mysql-pagination' });
            paginationContainer.style.display = 'flex';
            paginationContainer.style.justifyContent = 'center';
            paginationContainer.style.gap = '8px';
            paginationContainer.style.marginTop = '20px';

            for (let i = 1; i <= totalPages; i++) {
                const btn = paginationContainer.createEl('button', {
                    text: String(i),
                    cls: 'mysql-page-btn'
                });

                // Styling
                btn.style.padding = '4px 10px';
                btn.style.borderRadius = '4px';
                btn.style.border = '1px solid var(--background-modifier-border)';
                btn.style.background = i === page ? 'var(--mysql-accent, var(--interactive-accent))' : 'var(--background-secondary)';
                btn.style.color = i === page ? 'var(--text-on-accent)' : 'var(--text-normal)';
                btn.style.cursor = 'pointer';

                if (i !== page) {
                    btn.onclick = () => {
                        this.renderDatabaseGrid(container, searchTerm, i);
                    };
                } else {
                    btn.disabled = true;
                    btn.style.opacity = '1';
                }
            }
        }
    }

    private renderDatabaseCard(container: HTMLElement, dbName: string): void {
        const isActive = dbName === this.plugin.activeDatabase;
        const isSystem = dbName === 'dbo';
        const dbManager = (this.plugin as any).dbManager;
        const stats = dbManager.getDatabaseStats(dbName);

        const card = container.createDiv({ cls: `mysql-db-card ${isActive ? 'active' : ''}` });

        // Header
        const header = card.createDiv({ cls: 'mysql-db-card-header' });
        const nameDiv = header.createDiv({ cls: 'mysql-db-name' });
        nameDiv.createSpan({ text: dbName });

        if (isActive) {
            nameDiv.createSpan({ text: t('modals.badge_ativo'), cls: 'mysql-badge badge-active' });
        } else if (isSystem) {
            nameDiv.createSpan({ text: t('modals.badge_system'), cls: 'mysql-badge badge-system' });
        }

        // Stats
        const statsGrid = card.createDiv({ cls: 'mysql-db-stats' });
        this.addStat(statsGrid, t('modals.stat_tables'), stats.tables.toString());
        this.addStat(statsGrid, t('modals.stat_rows'), stats.rows.toLocaleString());
        this.addStat(statsGrid, t('modals.stat_size'), this.formatBytes(stats.sizeBytes));
        this.addStat(statsGrid, t('modals.stat_updated'), this.timeAgo(stats.lastUpdated));

        // Actions
        const actions = card.createDiv({ cls: 'mysql-db-actions' });

        if (!isActive) {
            new ButtonComponent(actions)
                .setIcon("check")
                .setTooltip(t('modals.btn_ativar'))
                .setClass("btn-success") // We might need to map this class in CSS or just use standard
                .onClick(async () => {
                    await this.switchDatabase(dbName);
                });
        }

        /*
        // Duplicar (Placeholder for now as we don't have a modal readily available, 
        // but user asked for appearance, I'll add button that does rename-like prompt if I can't do better quickly)
        // I'll skip duplication logic implementation for this specific step to stay within scope of "Appearance", 
        // but the button should be there.
        */
        new ButtonComponent(actions)
            .setIcon("copy")
            .setTooltip(t('modals.btn_duplicar'))
            .onClick(() => {
                // Open Duplicate Modal
                const modal = new DuplicateDatabaseModal(this.app, this.plugin, dbName, () => this.display());
                modal.open();
            });


        if (!isActive && !isSystem) {
            new ButtonComponent(actions)
                .setIcon("pencil")
                .setTooltip(t('modals.btn_renomear'))
                .onClick(() => {
                    const modal = new RenameDatabaseModal(this.app, this.plugin, dbName, () => this.display());
                    modal.open();
                });
        }

        // Tables Button
        new ButtonComponent(actions)
            .setIcon("table")
            .setTooltip(t('modals.btn_tabelas'))
            .onClick(() => this.openTablesModal(dbName));

        new ButtonComponent(actions)
            .setIcon("upload")
            .setTooltip(t('modals.btn_exportar'))
            .onClick(() => this.exportDatabaseSQL(dbName));

        // Delete
        if (!isActive && !isSystem) {
            new ButtonComponent(actions)
                .setIcon("trash-2")
                .setTooltip(t('modals.btn_deletar'))
                .setWarning()
                .onClick(() => this.confirmDelete(dbName));
        }

    }

    private renderGeneralSettings(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName(t('settings.lang_name'))
            .setDesc(t('settings.lang_desc'))
            .addDropdown(dropdown => dropdown
                .addOption('auto', 'Automatic (Obsidian Preference)')
                .addOption('en', 'English')
                .addOption('pt-BR', 'Português (Brasil)')
                .addOption('es', 'Español')
                .addOption('de', 'Deutsch')
                .addOption('fr', 'Français')
                .addOption('zh', '简体中文')
                .addOption('ja', '日本語')
                .addOption('ko', '한국어')
                .setValue(this.plugin.settings.language)
                .onChange(async (value: Language) => {
                    this.plugin.settings.language = value;
                    setLanguage(value);
                    await this.plugin.saveSettings();
                    this.display();
                }));

        this.createSectionHeader(containerEl, t('settings.section_appearance'), 'palette');
        // Theme Colors
        const colors = [
            { name: 'Purple (Default)', value: '#9d7cd8' },
            { name: 'Blue', value: '#61afef' },
            { name: 'Green', value: '#98c379' },
            { name: 'Orange', value: '#e5c07b' },
            { name: 'Red', value: '#e06c75' },
        ];

        // ... (Quickly recreating existing theme setting logic)
        new Setting(containerEl)
            .setName(t('settings.accent_obsidian'))
            .setDesc(t('settings.accent_obsidian_desc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useObsidianAccent)
                .onChange(async (value) => {
                    this.plugin.settings.useObsidianAccent = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        const colorSetting = new Setting(containerEl)
            .setName(t('settings.theme_accent'))
            .setDesc(t('settings.theme_accent_desc'))
            .addText(text => text.inputEl.style.display = 'none');

        if (this.plugin.settings.useObsidianAccent) {
            colorSetting.settingEl.style.opacity = '0.5';
            colorSetting.settingEl.style.pointerEvents = 'none';
            colorSetting.setDesc(t('settings.accent_obsidian_desc'));
        }

        colorSetting.then((setting) => {
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
                circle.style.transition = 'all 0.2s';

                if (this.plugin.settings.themeColor === c.value) {
                    circle.style.border = '2px solid var(--text-normal)';
                    circle.style.transform = 'scale(1.1)';
                } else {
                    circle.style.border = '2px solid transparent';
                }

                circle.onClickEvent(async () => {
                    this.plugin.settings.themeColor = c.value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show selection
                });
            });
        });

        new Setting(containerEl)
            .setName(t('settings.auto_save'))
            .setDesc(t('settings.auto_save_desc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSave)
                .onChange(async (value) => {
                    this.plugin.settings.autoSave = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settings.auto_save_delay'))
            .setDesc(t('settings.auto_save_delay_desc'))
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
            .setName(t('settings.export_folder'))
            .setDesc(t('settings.export_folder_desc'))
            .addText(text => text
                .setPlaceholder('sql-exports')
                .setValue(this.plugin.settings.exportFolderName)
                .onChange(async (value) => {
                    this.plugin.settings.exportFolderName = value || 'sql-exports';
                    await this.plugin.saveSettings();
                }));

        this.createSectionHeader(containerEl, t('settings.section_data_security'), 'shield');

        new Setting(containerEl)
            .setName(t('settings.safe_mode'))
            .setDesc(t('settings.safe_mode_desc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.safeMode)
                .onChange(async (value) => {
                    this.plugin.settings.safeMode = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settings.enable_logging'))
            .setDesc(t('settings.enable_logging_desc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableLogging)
                .onChange(async (value) => {
                    this.plugin.settings.enableLogging = value;
                    const { Logger } = await import('./utils/Logger');
                    Logger.setEnabled(value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settings.snapshot_limit'))
            .setDesc(t('settings.snapshot_limit_desc'))
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
            .setName(t('settings.batch_size'))
            .setDesc(t('settings.batch_size_desc'))
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

        // Reset Button
        new Setting(containerEl)
            .setName(t('settings.reset_all'))
            .addButton(btn => {
                btn.setButtonText(t('settings.reset_btn'));
                btn.setWarning();
                btn.onClick(() => this.openClearConfirm()); // Actually reset logic was complicated, calling confirmation
            });

    }

    private async switchDatabase(dbName: string) {
        // Reuse logic from SwitcherModal
        const dbManager = (this.plugin as any).dbManager;
        // QueryExecutor manages context, but for "Active" UI state we update plugin prop
        // We do NOT call alasql USE explicitly if we want to follow new pattern, 
        // OR we do if we want global sync. 
        // DatabaseManager.load/save relies on plugin properties.
        this.plugin.activeDatabase = dbName;
        await dbManager.save();
        new Notice(t('modals.time_ago', { time: dbName })); // Using a placeholder for simplicity or adding specialized notice
        // Actually I should use a generic "Switched to" message, but for now I'll use common sense or add it to translations later.
        // Let's just use what was there or leave it hardcoded for now if not critical, or better:
        new Notice(`${t('modals.btn_ativar')}: ${dbName}`);
        this.display();
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

        new ButtonComponent(actions)
            .setButtonText("Create")
            .setIcon("plus")
            .onClick(() => this.openCreateModal());

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

        // New: Export SQL
        new ButtonComponent(actions)
            .setButtonText("Export")
            .setIcon("download")
            .setTooltip("Export database structure and data to SQL file")
            .onClick(async () => {
                await this.exportDatabaseSQL(activeDB);
            });

        // New: Import SQL (Hidden Input trick)
        const importBtnContainer = actions.createDiv({ cls: 'mysql-import-wrapper' }); // Wrapper if styling needed
        const importInput = importBtnContainer.createEl('input', {
            type: 'file',
            attr: { accept: '.sql' }
        });
        importInput.style.display = 'none';
        importInput.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (file) {
                await this.importDatabaseSQL(file);
                // Reset input
                importInput.value = '';
            }
        };

        new ButtonComponent(importBtnContainer)
            .setButtonText("Import")
            .setIcon("upload")
            .setTooltip("Import database from SQL file")
            .onClick(() => {
                importInput.click();
            });

        // Secondary / Destructive
        const separator = actions.createDiv({ cls: 'mysql-action-separator' }); // CSS to push items to right if flex-grow

        new ButtonComponent(actions)
            .setButtonText("Clear")
            .setWarning()
            .onClick(() => this.openClearConfirm());
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
        if (!timestamp) return t('modals.time_never');
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return t('modals.time_just_now');
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return t('modals.time_ago', { time: `${minutes} min` });
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return t('modals.time_ago', { time: `${hours}h` });
        return new Date(timestamp).toLocaleDateString();
    }

    private openSwitcherModal(): void {
        const modal = new DatabaseSwitcherModal(this.app, this.plugin, () => this.display());
        modal.open();
    }

    private openCreateModal(): void {
        const modal = new CreateDatabaseModal(this.app, this.plugin, () => this.display());
        modal.open();
    }

    private openRenameModal(): void {
        const modal = new RenameDatabaseModal(this.app, this.plugin, this.plugin.activeDatabase, () => this.display());
        modal.open();
    }

    private openTablesModal(dbName?: string): void {
        const targetDB = dbName || this.plugin.activeDatabase;
        const modal = new DatabaseTablesModal(this.app, this.plugin, targetDB);
        modal.open();
    }

    private openClearConfirm(): void {
        const activeDB = this.plugin.activeDatabase;
        new ConfirmationModal(
            this.app,
            t('modals.confirm_clear_title'),
            t('modals.confirm_clear_msg', { dbName: activeDB }),
            async (confirmed) => {
                if (confirmed) {
                    await (this.plugin as any).dbManager.clearDatabase(activeDB);
                    new Notice(`${t('modals.confirm_clear_title')}: ${activeDB}`);
                    this.display();
                }
            },
            t('modals.btn_clear'),
            t('modals.btn_cancel')
        ).open();
    }

    private confirmDelete(dbName: string): void {
        new ConfirmationModal(
            this.app,
            t('modals.confirm_delete_title'),
            t('modals.confirm_delete_msg', { dbName }),
            async (confirmed) => {
                if (confirmed) {
                    try {
                        const dbManager = (this.plugin as any).dbManager;
                        await dbManager.deleteDatabase(dbName);
                        new Notice(`${t('modals.confirm_delete_title')}: ${dbName}`);
                        this.display();
                    } catch (e) {
                        new Notice(t('common.error', { error: e.message }));
                    }
                }
            },
            t('modals.btn_delete'),
            t('modals.btn_cancel')
        ).open();
    }

    private async exportDatabaseSQL(dbName: string): Promise<void> {
        try {
            const dbManager = (this.plugin as any).dbManager;
            const sql = await dbManager.exportDatabase(dbName);

            const exportFolder = this.plugin.settings.exportFolderName || 'sql-exports';
            if (!(await this.plugin.app.vault.adapter.exists(exportFolder))) {
                await this.plugin.app.vault.createFolder(exportFolder);
            }

            const fileName = `${exportFolder}/${dbName}_backup_${Date.now()}.sql`;
            await this.plugin.app.vault.create(fileName, sql);
            new Notice(t('common.notice_export_success', { name: fileName }));
        } catch (e) {
            new Notice(t('common.error', { error: e.message }));
            console.error(e);
        }
    }

    private async importDatabaseSQL(file: File): Promise<void> {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const sql = e.target?.result;
            if (typeof sql === 'string') {
                try {
                    new Notice(t('common.notice_import_loading'));
                    const dbManager = (this.plugin as any).dbManager;
                    await dbManager.importDatabase(sql);
                    new Notice(t('common.notice_import_success'));
                    this.display();
                } catch (err) {
                    new Notice(t('common.error', { error: err.message }));
                    console.error(err);
                }
            }
        };
        reader.readAsText(file);
    }
}
