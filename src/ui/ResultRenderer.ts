import { App, MarkdownView, Notice } from 'obsidian';
import html2canvas from 'html2canvas';
import { IMySQLPlugin, QueryResult } from '../types';

export class ResultRenderer {
    static render(result: QueryResult, container: HTMLElement, app: App, plugin: IMySQLPlugin, tableName?: string): void {
        container.empty();

        if (!result.success) {
            this.renderError(result.error || 'Unknown error', container);
            return;
        }

        const data = result.data || [];
        const wrapper = container.createEl("div", { cls: "mysql-result-wrapper" });

        // Metadata
        if (result.executionTime !== undefined) {
            const meta = wrapper.createEl("div", { cls: "mysql-metadata" });
            meta.innerHTML = `⏱️ Execution time: <strong>${result.executionTime}ms</strong>`;
        }

        this.renderData(data, wrapper, app, plugin, tableName);
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
            attr: { title: "Copy result to clipboard" }
        });
        copyBtn.innerHTML = `📋 Copy`;
        copyBtn.onclick = () => this.copyToClipboard(data);

        // Botão: Screenshot
        const screenshotBtn = container.createEl("button", {
            cls: "mysql-action-btn",
            attr: { title: "Take screenshot of result" }
        });
        screenshotBtn.innerHTML = `📸 Screenshot`;
        screenshotBtn.onclick = () => this.takeScreenshot(resultWrapper);

        // Botão: Inserir na nota
        const insertBtn = container.createEl("button", {
            cls: "mysql-action-btn",
            attr: { title: "Insert result into note" }
        });
        insertBtn.innerHTML = `📝 Insert`;
        insertBtn.onclick = () => this.insertIntoNote(data, app);

        // Botão: Export CSV (If table name is known)
        if (tableName) {
            const exportBtn = container.createEl("button", {
                cls: "mysql-action-btn",
                attr: { title: "Export result to CSV" }
            });
            exportBtn.innerHTML = `📤 Export CSV`;
            exportBtn.onclick = async () => {
                // We use the plugin's CSVManager logic via accessing plugin instance
                // But ResultRenderer is static... we passed plugin instance.
                // We can't access private 'csvManager' if not exposed in interface?
                // The interface IMySQLPlugin might explicitly need csvManager in types or we cast.
                // Or better, we can assume 'tableName' refers to a real table and re-query via CSVManager,
                // OR simpler: export current *data* to CSV.
                // CSVManager.exportTable exports the *TABLE* from AlaSQL.
                // If we have data here, we can export this data directly to CSV without querying again?
                // But the user requested "Export CSV button... of existing AlaSQL table".
                // So calling CSVManager.exportTable(tableName) is the correct behavior.
                // As 'plugin' is IMySQLPlugin, we can cast to any to access csvManager if we didn't put it in interface.
                // I will update interface in next step if needed, or cast here.
                const csvManager = (plugin as any).csvManager;
                if (csvManager && csvManager.exportTable) {
                    await csvManager.exportTable(tableName);
                } else {
                    new Notice("CSV Manager not available");
                }
            };
        }
    }

    private static async copyToClipboard(data: any): Promise<void> {
        try {
            let textToCopy = '';

            if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
                // Tabela -> formato TSV (Tab Separated Values)
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
                // Scalar value -> plain text
                textToCopy = String(data);
            } else {
                // JSON generic object
                textToCopy = JSON.stringify(data, null, 2);
            }

            await navigator.clipboard.writeText(textToCopy);
            new Notice('✓ Copied to clipboard!');
        } catch (error) {
            new Notice('❌ Failed to copy: ' + error.message);
        }
    }

    private static async takeScreenshot(element: HTMLElement): Promise<void> {
        try {
            const canvas = await html2canvas(element, {
                backgroundColor: getComputedStyle(element).backgroundColor || '#ffffff',
                scale: 2, // Higher quality
                logging: false
            });

            canvas.toBlob(async (blob: Blob | null) => {
                if (!blob) {
                    new Notice('❌ Failed to create screenshot');
                    return;
                }

                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    new Notice('✓ Screenshot copied to clipboard!');
                } catch (clipboardError) {
                    // Fallback: download como arquivo
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `mysql-result-${Date.now()}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                    new Notice('✓ Screenshot downloaded!');
                }
            });
        } catch (error) {
            new Notice('❌ Screenshot failed: ' + error.message);
            console.error('Screenshot error:', error);
        }
    }

    private static async insertIntoNote(data: any, app: App): Promise<void> {
        try {
            const activeView = app.workspace.getActiveViewOfType(MarkdownView);

            if (!activeView) {
                new Notice('❌ No active note found');
                return;
            }

            const editor = activeView.editor;
            let textToInsert = '';

            // Gerar markdown apropriado
            if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
                // Tabela -> Markdown table
                textToInsert = this.dataToMarkdownTable(data);
            } else if (typeof data === 'number') {
                textToInsert = `**Result:** ${data} row(s) affected`;
            } else {
                // JSON em code block
                textToInsert = '```json\n' + JSON.stringify(data, null, 2) + '\n```';
            }

            // Inserir no cursor
            const cursor = editor.getCursor();
            editor.replaceRange('\n' + textToInsert + '\n', cursor);

            // Mover cursor para depois do texto inserido
            const lines = textToInsert.split('\n').length;
            editor.setCursor({ line: cursor.line + lines + 1, ch: 0 });

            new Notice('✓ Result inserted into note!');
        } catch (error) {
            new Notice('❌ Failed to insert: ' + error.message);
        }
    }

    private static dataToMarkdownTable(rows: any[]): string {
        if (rows.length === 0) return '_No data_';

        const keys = Object.keys(rows[0]);

        // Header
        let md = '| ' + keys.join(' | ') + ' |\n';

        // Separator
        md += '| ' + keys.map(() => '---').join(' | ') + ' |\n';

        // Rows
        rows.forEach(row => {
            const values = keys.map(k => {
                const val = row[k];
                if (val === null || val === undefined) return '';
                // Escapar pipes no conteúdo
                return String(val).replace(/\|/g, '\\|');
            });
            md += '| ' + values.join(' | ') + ' |\n';
        });

        return md;
    }

    private static renderData(results: any[], container: HTMLElement, app: App, plugin: IMySQLPlugin, tableName?: string): void {
        if (!Array.isArray(results) || results.length === 0) {
            container.createEl("p", {
                text: "Query executed successfully (no result set)",
                cls: "mysql-info"
            });
            return;
        }

        results.forEach((rs, idx) => {
            const rsWrapper = container.createEl("div", { cls: "mysql-result-set" });
            if (results.length > 1) {
                rsWrapper.createEl("h4", { text: `Result #${idx + 1}`, cls: "mysql-result-header" });
            }

            // Local Actions for this specific result set
            if (rs.type === 'table' || rs.type === 'scalar') {
                const actions = rsWrapper.createEl("div", { cls: "mysql-result-actions" });
                this.addActionButtons(actions, rs.data, rsWrapper, app, plugin, rs.type === 'table' ? tableName : undefined);
            }

            switch (rs.type) {
                case 'table':
                    this.renderTable(rs.data, rsWrapper);
                    break;
                case 'scalar':
                    if (typeof rs.data === 'number') {
                        // Semantic labeling: if it's a batch we likely filtered status codes,
                        // so a lone scalar is likely a COUNT or specific value.
                        rsWrapper.createEl("div", {
                            text: String(rs.data),
                            cls: "mysql-scalar-value"
                        });
                    } else {
                        rsWrapper.createEl("pre", {
                            text: JSON.stringify(rs.data, null, 2),
                            cls: "mysql-json-result"
                        });
                    }
                    break;
                case 'message':
                case 'error':
                    const isDML = rs.type === 'message' && rs.message && rs.message.includes('affected');
                    rsWrapper.createEl("p", {
                        text: rs.message || "Done",
                        cls: rs.type === 'error' ? "mysql-error-inline" : (isDML ? "mysql-success-inline" : "mysql-info")
                    });
                    break;
            }

            if (rs.rowCount !== undefined && rs.type === 'table') {
                const rowInfo = rsWrapper.createEl("div", { cls: "mysql-row-count" });
                rowInfo.setText(`(${rs.rowCount} rows)`);
            }
        });
    }

    private static renderTable(rows: any[], container: HTMLElement, batchSize: number = 100): void {
        const keys = Object.keys(rows[0]);
        const table = container.createEl("table", { cls: "mysql-table" });

        // Header
        const thead = table.createEl("thead");
        const headerRow = thead.createEl("tr");
        keys.forEach(key => headerRow.createEl("th", { text: key }));

        // Body
        const tbody = table.createEl("tbody");
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

        // Renderizar primeiro lote
        const initialBatch = rows.slice(0, batchSize);
        renderBatch(initialBatch);
        currentCount += initialBatch.length;

        // Controles de paginação
        if (rows.length > batchSize) {
            const controls = container.createEl("div", { cls: "mysql-pagination" });
            controls.createEl("span", { text: `Shows ${currentCount} / ${rows.length} rows ` });

            const showAllBtn = controls.createEl("button", { text: "Show All" });
            showAllBtn.onclick = () => {
                const remaining = rows.slice(currentCount);
                renderBatch(remaining);
                showAllBtn.remove();
                controls.querySelector("span")!.setText(`Shows ${rows.length} / ${rows.length} rows `);
            };
        }
    }

    private static renderError(message: string, container: HTMLElement): void {
        const errorDiv = container.createEl("div", { cls: "mysql-error" });
        errorDiv.createEl("strong", { text: "Error: " });
        errorDiv.createEl("span", { text: message });
    }
}
