import { App, Editor, MarkdownView, Modal, Notice, Plugin } from 'obsidian';
// @ts-ignore
import alasql from 'alasql';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';

export default class MySQLPlugin extends Plugin {
    async onload() {
        // Initialize AlaSQL with MySQL compatibility
        alasql.options.mysql = true;

        // Fix 2: Strict check to prevent "Database already exists" on rapid reloads
        if (!alasql.databases.empresa) {
            alasql('CREATE DATABASE empresa;');
        }
        alasql('USE empresa;');

        // Fix 3: BigInt Warning
        console.warn("MySQL Plugin: Note that BigInt support is limited by standard JavaScript Number precision (> 2^53).");

        // Check for saved data
        await this.loadDatabase();

        // Register the Code Block Processor
        this.registerMarkdownCodeBlockProcessor("mysql", async (source, el, ctx) => {
            const code = source.trim();
            if (!code) return;
            el.addClass("mysql-workbench-container");
            const codeBlock = el.createEl("pre", { cls: "mysql-source-code" });
            // Apply Syntax Highlighting
            const highlighted = Prism.highlight(code, Prism.languages.sql, 'sql');
            codeBlock.innerHTML = `<code>${highlighted}</code>`;
            codeBlock.addClass("language-sql");
            // ... (rest of controls flow handled in previous step)

            // 2. Controls (Run Button)
            const controls = el.createEl("div", { cls: "mysql-controls" });
            const runBtn = controls.createEl("button", { cls: "mod-cta mysql-btn-run" });
            runBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Run SQL`;

            const resetButton = controls.createEl("button", { cls: "mysql-reset-btn" });
            resetButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg> Reset`;

            const exportButton = controls.createEl("button", { cls: "mysql-btn" });
            exportButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Save`;

            const showTablesButton = controls.createEl("button", { cls: "mysql-btn" });
            showTablesButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg> Tables`;

            // 3. Result Container
            const resultContainer = el.createEl("div", { cls: "mysql-result-container" });

            // Event Handlers
            // Event Handlers
            runBtn.onclick = async () => {
                resultContainer.empty();
                runBtn.disabled = true;
                runBtn.innerHTML = `<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Executing...`;

                try {
                    // Pre-process code to strip unsupported MySQL syntax
                    const cleanedCode = this.cleanSQL(code);
                    const result = await alasql.promise(cleanedCode);

                    // Auto-save logic
                    if (!cleanedCode.trim().toUpperCase().startsWith('SELECT') && !cleanedCode.trim().toUpperCase().startsWith('SHOW')) {
                        await this.saveDatabase();
                        new Notice('SQL executed & saved!');
                    }

                    this.renderResult(result, resultContainer);
                } catch (error) {
                    new Notice('SQL Execution Failed', 5000); // System toast
                    this.renderError(error, resultContainer);
                } finally {
                    runBtn.disabled = false;
                    runBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Run SQL`;
                }
            };

            exportButton.onclick = async () => {
                await this.saveDatabase();
                new Notice("Database saved to disk.");
            };

            showTablesButton.onclick = async () => {
                try {
                    const result = await alasql.promise("SHOW TABLES") as any[];
                    resultContainer.empty();
                    resultContainer.createEl("h6", { text: "Existing Tables:", cls: "mysql-result-title" });

                    if (result.length === 0) {
                        resultContainer.createEl("p", { text: "No tables found.", cls: "mysql-metadata" });
                    } else {
                        // Render a grid of buttons for tables
                        const grid = resultContainer.createEl("div", { cls: "mysql-table-grid" });

                        result.forEach(row => {
                            const tableName = row.tableid;
                            const btn = grid.createEl("button", { cls: "mysql-table-card" });
                            btn.innerHTML = `
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                                <span>${tableName}</span>
                            `;

                            btn.onclick = async () => {
                                // "Open" the table (Run SELECT *)
                                resultContainer.empty();
                                try {
                                    new Notice(`Fetching data for '${tableName}'...`);
                                    const data = await alasql.promise(`SELECT * FROM ${tableName}`);

                                    // Header with back button
                                    const header = resultContainer.createEl("div", { cls: "mysql-result-header" });
                                    const backBtn = header.createEl("button", { text: "← Back to Tables", cls: "mysql-link-btn" });
                                    header.createEl("span", { text: `Table: ${tableName}`, cls: "mysql-result-title" });

                                    backBtn.onclick = () => showTablesButton.click(); // Re-trigger show tables

                                    this.renderResult(data, resultContainer);
                                } catch (err) {
                                    this.renderError(err, resultContainer);
                                }
                            };
                        });
                    }
                } catch (e) {
                    this.renderError(e, resultContainer);
                }
            };

            resetButton.onclick = async () => {
                // Reset example DB
                if (!confirm("Are you sure you want to drop all tables in 'empresa'?")) return;

                try {
                    alasql('DROP DATABASE IF EXISTS empresa');
                    // Also clear saved data
                    await this.saveData({});
                    alasql('CREATE DATABASE empresa; USE empresa;');

                    resultContainer.empty();
                    new Notice('Database reset.');
                    resultContainer.createEl("p", { text: "Database reset. Clean slate.", cls: "mysql-metadata" });
                } catch (e) {
                    console.error(e);
                }
            };
        });
    }

    cleanSQL(sql: string): string {
        // Advanced sanitization for MySQL Workbench compatibility
        let cleaned = sql
            // Remove comments (Block /* ... */ and Line -- ...)
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/--.*$/gm, "")
            // Remove Charset/Collate in various formats
            .replace(/(DEFAULT )?(CHARACTER SET|CHARSET)\s*=?\s*[\w\d_]+/gi, "")
            .replace(/(DEFAULT )?COLLATE\s*=?\s*[\w\d_]+/gi, "")
            // Remove Engine definitions
            .replace(/ENGINE\s*=?\s*[\w\d_]+/gi, "")
            // Remove ROW_FORMAT options
            .replace(/ROW_FORMAT\s*=?\s*[\w\d_]+/gi, "")
            // Remove 'USE empresa' (case insensitive, various spacings)
            .replace(/USE\s+empresa\s*;?/gi, "")
            // Remove 'CREATE DATABASE ... empresa ... ;' aggressively
            // Matches optional 'IF NOT EXISTS', 'empresa', and everything until the next semicolon
            .replace(/CREATE\s+DATABASE\s+(IF\s+NOT\s+EXISTS\s+)?empresa[^;]*;?/gi, "")
            // Fix 1: Remove AUTO_INCREMENT options (common in dumps)
            .replace(/AUTO_INCREMENT\s*=?\s*\d+/gi, "")
            // Fix 1: Remove LOCK/UNLOCK TABLES (not supported by AlaSQL in this mode)
            .replace(/LOCK\s+TABLES\s+[^;]+;/gi, "")
            .replace(/UNLOCK\s+TABLES\s*;?/gi, "")
            // Clean empty lines left by removals
            .replace(/^\s*[\r\n]/gm, "");

        return cleaned;
    }


    async loadDatabase() {
        const data = await this.loadData();
        if (data) {
            try {
                // If tables exist in saved data, populate AlaSQL
                for (const [tableName, rows] of Object.entries(data)) {
                    await alasql.promise(`DROP TABLE IF EXISTS ${tableName}`);
                    await alasql.promise(`CREATE TABLE ${tableName} (temp INT)`); // Temp column, will be overwritten by data
                    await alasql.promise(`SELECT * INTO ${tableName} FROM ?`, [rows]);
                }
                console.log("MySQL Plugin: Database restored from disk.");
            } catch (e) {
                console.error("MySQL Plugin: Error loading database", e);
            }
        }
    }

    async saveDatabase() {
        try {
            // Get all tables
            const tables: { tableid: string }[] = await alasql.promise("SHOW TABLES");
            const dataToSave: { [key: string]: any[] } = {};

            for (const table of tables) {
                const tableName = table.tableid;
                const rows = await alasql.promise(`SELECT * FROM ${tableName}`) as any[];
                dataToSave[tableName] = rows;
            }

            await this.saveData(dataToSave);
            console.log("MySQL Plugin: Database saved to disk.");
        } catch (e) {
            console.error("MySQL Plugin: Error saving database", e);
        }
    }

    onunload() {
    }

    renderResult(result: any, el: HTMLElement) {
        // Wrapper for scrollability if needed
        const wrapper = el.createEl("div");
        wrapper.style.overflowX = "auto";

        // Handle null/undefined
        if (result === undefined || result === null) {
            return; // Nothing to render
        }

        // Determine if it's a Multi-Statement Result (Array of Results) OR a Single Result (Array of Rows or Single Object)
        let isMultiStatement = false;

        if (Array.isArray(result)) {
            // Empty array -> could be empty result set or empty script result. Treat as single.
            if (result.length > 0) {
                const firstItem = result[0];
                // If the first item is an Array, it's definitely a list of result sets (e.g. [ [row,row], [row,row] ])
                if (Array.isArray(firstItem)) {
                    isMultiStatement = true;
                }
                // If the first item is a number (affected rows), it's likely a script result (e.g. [1, 1, 5]) 
                // BUT wait, could a single SELECT return [1, 2]? No, rows are objects.
                else if (typeof firstItem === 'number') {
                    isMultiStatement = true;
                }
                // If the first item is a generic object like {affectedRows: ...} (not standard AlaSQL but possible)
                // We assume if it's "Row-like" (plain object), it's a Single Result Set.
            }
        }

        if (isMultiStatement) {
            // Render each sub-result
            (result as any[]).forEach((subResult, index) => {
                this.renderSingleResult(subResult, wrapper, index);
            });
        } else {
            // Single Result (Table or Metadata)
            this.renderSingleResult(result, wrapper);
        }
    }

    renderSingleResult(data: any, container: HTMLElement, index?: number) {
        const section = container.createEl("div");
        section.addClass("mysql-result-section");

        // Add a small divider/label for multiple results to be clearer
        if (index !== undefined) {
            section.createEl("h6", { text: `Result #${index + 1}`, cls: "mysql-result-title" });
        }

        // Case 1: Array of rows (SELECT)
        if (Array.isArray(data)) {
            if (data.length === 0) {
                section.createEl("p", { text: "Query executed successfully. (0 rows returned)", cls: "mysql-metadata" });
                return;
            }

            const isRowData = typeof data[0] === 'object' && data[0] !== null;
            if (isRowData) {
                this.renderTable(data, section);
            } else {
                // Primitive array?
                section.createEl("pre", { text: JSON.stringify(data, null, 2) });
            }
            return;
        }

        // Case 2: Metadata object (INSERT/UPDATE/DELETE)
        if (typeof data === 'number') {
            section.createEl("p", { text: `Query executed. Affected rows: ${data}`, cls: "mysql-metadata" });
            return;
        }

        if (typeof data === 'object') {
            section.createEl("p", { text: `Result: ${JSON.stringify(data)}`, cls: "mysql-metadata" });
            return;
        }
    }

    renderTable(rows: any[], el: HTMLElement) {
        const uniqueKeys = new Set<string>();
        rows.forEach(row => Object.keys(row).forEach(k => uniqueKeys.add(k)));
        const keys = Array.from(uniqueKeys);

        const table = el.createEl("table");
        table.addClass("mysql-table");

        // Header
        const thead = table.createEl("thead");
        const headerRow = thead.createEl("tr");

        keys.forEach(key => {
            headerRow.createEl("th", { text: key });
        });

        // Body
        const tbody = table.createEl("tbody");
        rows.forEach(row => {
            const tr = tbody.createEl("tr");
            keys.forEach(key => {
                const val = row[key];
                tr.createEl("td", { text: val === null || val === undefined ? "NULL" : String(val) });
            });
        });
    }

    renderError(error: any, el: HTMLElement) {
        const errDiv = el.createEl("div");
        errDiv.addClass("mysql-error");
        errDiv.createEl("strong", { text: "SQL Error: " });
        errDiv.createEl("span", { text: error.message || String(error) });
    }
}
