import { App, MarkdownView, Notice, setIcon } from 'obsidian';
import html2canvas from 'html2canvas';
import { IMySQLPlugin, QueryResult } from '../types';
import { FormRenderer } from './FormRenderer';
import { t } from '../utils/i18n';

export class ResultRenderer {
    static render(result: QueryResult, container: HTMLElement, app: App, plugin: IMySQLPlugin, tableName?: string, isLive: boolean = false): void {
        container.empty();

        if (!result.success) {
            this.renderError(result.error || t('modals.badge_system'), container); // Fallback to 'System' or generic if not found
            return;
        }

        const data = result.data || [];
        const wrapper = container.createEl("div", { cls: "mysql-result-container" });

        this.renderData(data, wrapper, app, plugin, tableName, isLive);
    }

    private static addActionButtons(
        container: HTMLElement,
        data: any,
        resultWrapper: HTMLElement,
        app: App,
        plugin: IMySQLPlugin,
        tableName?: string
    ): void {
        // Botão: Copiar
        const copyBtn = container.createEl("button", {
            cls: "mysql-action-btn",
            attr: { title: t('renderer.tip_copy') }
        });
        setIcon(copyBtn, "copy");
        copyBtn.createSpan({ text: t('renderer.btn_copy') });
        copyBtn.onclick = () => this.copyToClipboard(data);

        // Botão: Screenshot
        const screenshotBtn = container.createEl("button", {
            cls: "mysql-action-btn",
            attr: { title: t('renderer.tip_screenshot') }
        });
        setIcon(screenshotBtn, "camera");
        screenshotBtn.createSpan({ text: t('renderer.btn_screenshot') });
        screenshotBtn.onclick = () => this.takeScreenshot(resultWrapper);

        // Botão: Inserir na nota
        const insertBtn = container.createEl("button", {
            cls: "mysql-action-btn",
            attr: { title: t('renderer.tip_add_note') }
        });
        setIcon(insertBtn, "file-plus");
        insertBtn.createSpan({ text: t('renderer.btn_add_note') });
        insertBtn.onclick = () => this.insertIntoNote(data, app);
    }

    private static async copyToClipboard(data: any): Promise<void> {
        try {
            let textToCopy = '';

            if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
                const keys = Object.keys(data[0]);
                textToCopy = keys.join('\t') + '\n';

                data.forEach(row => {
                    const values = keys.map(k => {
                        const val = row[k];
                        return val === null || val === undefined ? '' : String(val);
                    });
                    textToCopy += values.join('\t') + '\n';
                });
            } else if (typeof data !== 'object' || data === null) {
                textToCopy = String(data);
            } else {
                textToCopy = JSON.stringify(data, null, 2);
            }

            await navigator.clipboard.writeText(textToCopy);
            new Notice(t('renderer.notice_copied'));
        } catch (error) {
            new Notice(t('renderer.notice_copy_failed', { error: error.message }));
        }
    }

    private static async takeScreenshot(element: HTMLElement): Promise<void> {
        try {
            const canvas = await html2canvas(element, {
                backgroundColor: getComputedStyle(element).backgroundColor || '#ffffff',
                scale: 2,
                logging: false
            });

            canvas.toBlob(async (blob: Blob | null) => {
                if (!blob) {
                    new Notice(t('renderer.notice_screenshot_failed', { error: 'Canvas blob failed' }));
                    return;
                }

                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    new Notice(t('renderer.notice_screenshot_copied'));
                } catch (clipboardError) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `mysql-result-${Date.now()}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                    new Notice(t('renderer.notice_screenshot_downloaded'));
                }
            });
        } catch (error) {
            new Notice(t('renderer.notice_screenshot_failed', { error: error.message }));
            console.error('Screenshot error:', error);
        }
    }

    private static async insertIntoNote(data: any, app: App): Promise<void> {
        try {
            const activeView = app.workspace.getActiveViewOfType(MarkdownView);

            if (!activeView) {
                new Notice(t('renderer.notice_insert_no_note'));
                return;
            }

            const editor = activeView.editor;
            let textToInsert = '';

            if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
                textToInsert = this.dataToMarkdownTable(data);
            } else if (typeof data === 'number') {
                textToInsert = `**Result:** ${data} row(s) affected`;
            } else {
                textToInsert = '```json\n' + JSON.stringify(data, null, 2) + '\n```';
            }

            const cursor = editor.getCursor();
            editor.replaceRange('\n' + textToInsert + '\n', cursor);

            const lines = textToInsert.split('\n').length;
            editor.setCursor({ line: cursor.line + lines + 1, ch: 0 });

            new Notice(t('renderer.notice_insert_success'));
        } catch (error) {
            new Notice(t('renderer.notice_insert_failed', { error: error.message }));
        }
    }

    private static dataToMarkdownTable(rows: any[]): string {
        if (rows.length === 0) return '_No data_';

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

    private static renderData(results: any[], container: HTMLElement, app: App, plugin: IMySQLPlugin, tableName?: string, isLive: boolean = false): void {
        if (!Array.isArray(results) || results.length === 0) {
            container.createEl("p", {
                text: t('renderer.msg_no_result'),
                cls: "mysql-info"
            });
            return;
        }

        results.forEach((rs, idx) => {
            const rsWrapper = container.createEl("div", { cls: "mysql-result-set" });

            // Unified Result Header
            const header = rsWrapper.createDiv({ cls: "mysql-result-header" });
            if (isLive) header.style.display = "none";

            // Content Wrapper (This is what will be screenshotted)
            const contentWrapper = rsWrapper.createDiv({ cls: "mysql-result-content" });

            // Left: Title / Source
            const left = header.createDiv({ cls: "mysql-header-left" });
            setIcon(left, results.length > 1 ? "list" : "database");
            const labelText = results.length > 1 ? t('renderer.result_label', { idx: String(idx + 1) }) : (tableName ? t('renderer.table_label', { name: tableName }) : t('renderer.query_result'));
            left.createSpan({ text: labelText, cls: "mysql-result-label" });

            // Right: Meta + Actions
            const right = header.createDiv({ cls: "mysql-header-right" });

            if (rs.type === 'table' || rs.type === 'scalar') {
                const actions = right.createDiv({ cls: "mysql-result-actions" });
                // We'll pass the content wrapper to capture ONLY the data
                this.addActionButtons(actions, rs.data, contentWrapper, app, plugin, rs.type === 'table' ? tableName : undefined);
            }

            switch (rs.type) {
                case 'table':
                    this.renderTable(rs.data, contentWrapper);
                    break;
                case 'scalar':
                    if (typeof rs.data === 'number') {
                        contentWrapper.createEl("div", {
                            text: String(rs.data),
                            cls: "mysql-scalar-value"
                        });
                    } else {
                        contentWrapper.createEl("pre", {
                            text: JSON.stringify(rs.data, null, 2),
                            cls: "mysql-json-result"
                        });
                    }
                    break;
                case 'message':
                case 'error':
                    const isDML = rs.type === 'message' && rs.message && rs.message.includes('affected');
                    const msgWrapper = contentWrapper.createDiv({
                        cls: rs.type === 'error' ? 'mysql-error-inline' : (isDML ? 'mysql-success-state mysql-msg-compact' : 'mysql-info-state mysql-msg-compact')
                    });

                    if (rs.type === 'error') {
                        const iconWrapper = msgWrapper.createDiv({ cls: "mysql-error-icon" });
                        setIcon(iconWrapper, "alert-circle");
                        msgWrapper.createSpan({ text: rs.message || t('modals.status_error') });
                    } else {
                        const iconWrapper = msgWrapper.createDiv({ cls: isDML ? "mysql-success-icon" : "mysql-info-icon" });
                        setIcon(iconWrapper, isDML ? "check-circle" : "info");
                        msgWrapper.createDiv({
                            text: rs.message || t('modals.status_done'),
                            cls: isDML ? "mysql-success" : "mysql-info-text"
                        });
                    }

                    break;
                case 'form':
                    FormRenderer.render(rs.data, contentWrapper, app, plugin);
                    break;
            }

            if (rs.rowCount !== undefined && rs.type === 'table') {
                const rowInfo = contentWrapper.createDiv({ cls: "mysql-row-count-wrapper" });
                if (isLive) rowInfo.style.display = "none";
                const countIcon = rowInfo.createDiv({ cls: "mysql-count-icon" });
                setIcon(countIcon, "list-ordered");
                rowInfo.createSpan({ text: t('renderer.msg_rows_found', { count: String(rs.rowCount) }), cls: "mysql-row-count-text" });
            }
        });
    }

    private static renderTable(rows: any[], container: HTMLElement, batchSize: number = 100): void {
        if (!rows || rows.length === 0) {
            container.createEl("p", { text: t('renderer.msg_no_data'), cls: "mysql-empty-state" });
            return;
        }

        const keys = Object.keys(rows[0]);
        const table = container.createEl("table", { cls: "mysql-table" });

        const thead = table.createEl("thead");
        const headerRow = thead.createEl("tr");
        keys.forEach(key => headerRow.createEl("th", { text: key }));

        const tbody = table.createEl("tbody");
        let currentCount = 0;

        const renderBatch = (batch: any[]) => {
            batch.forEach(row => {
                const tr = tbody.createEl("tr");
                keys.forEach(key => {
                    const val = row[key];
                    tr.createEl("td", {
                        text: val === null || val === undefined ? t('modals.null_value') : String(val)
                    });
                });
            });
        };

        const initialBatch = rows.slice(0, batchSize);
        renderBatch(initialBatch);
        currentCount += initialBatch.length;

        if (rows.length > batchSize) {
            const controls = container.createEl("div", { cls: "mysql-pagination-controls" });

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
    }

    private static renderError(message: string, container: HTMLElement): void {
        const errorDiv = container.createDiv({ cls: "mysql-error" });

        const header = errorDiv.createDiv({ cls: "mysql-error-header" });
        const iconWrapper = header.createDiv({ cls: "mysql-error-icon" });
        setIcon(iconWrapper, "alert-circle");
        header.createSpan({ text: t('renderer.err_title'), cls: "mysql-error-title" });

        errorDiv.createDiv({ text: message, cls: "mysql-error-message" });
    }
}
