import { App, Editor, MarkdownView, Modal, Notice, Plugin, TFile, FuzzySuggestModal } from 'obsidian';
// @ts-ignore
import alasql from 'alasql';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';

export default class MySQLPlugin extends Plugin {
    currentDB: string = 'empresa';

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

            // 1.5 Parameter Detection
            const paramRegex = /:([a-zA-Z0-9_]+)/g;
            const matches = Array.from(code.matchAll(paramRegex)).map(m => m[1]);
            const uniqueParams = [...new Set(matches)]; // Dedupe
            const paramValues: { [key: string]: any } = {};

            const controls = el.createEl("div", { cls: "mysql-controls" });

            if (uniqueParams.length > 0) {
                const paramContainer = controls.createEl("div", { cls: "mysql-params-container" });
                paramContainer.style.width = "100%";
                paramContainer.style.marginBottom = "10px";
                paramContainer.style.padding = "10px";
                paramContainer.style.background = "var(--background-secondary)";
                paramContainer.style.borderRadius = "4px";

                paramContainer.createEl("h6", { text: "Query Parameters" });

                uniqueParams.forEach(param => {
                    const wrapper = paramContainer.createEl("div", { cls: "mysql-param-wrapper" });
                    wrapper.style.display = "flex";
                    wrapper.style.alignItems = "center";
                    wrapper.style.marginBottom = "5px";

                    wrapper.createEl("label", { text: param + ": ", cls: "mysql-param-label" }).style.marginRight = "10px";
                    const input = wrapper.createEl("input", { type: "text", cls: "mysql-param-input" });
                    // Default empty
                    paramValues[param] = "";

                    input.oninput = (e) => {
                        paramValues[param] = (e.target as HTMLInputElement).value;
                    };
                });
            }

            // 2. Controls (Run Button)
            // const controls = el.createEl("div", { cls: "mysql-controls" }); // Already created above
            const runBtn = controls.createEl("button", { cls: "mod-cta mysql-btn-run" });
            runBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Run`;

            // DB Switcher
            const dbControls = controls.createEl("div", { cls: "mysql-db-controls" });
            const dbSelect = dbControls.createEl("select", { cls: "mysql-db-select" });

            const refreshDBs = () => {
                dbSelect.innerHTML = "";
                const dbs = Object.keys(alasql.databases).filter(d => d !== 'alasql');
                dbs.forEach(db => {
                    const opt = dbSelect.createEl("option", { text: db, value: db });
                    if (db === alasql.useid) opt.selected = true;
                });
            };
            refreshDBs();

            dbSelect.onchange = async () => {
                const newDB = dbSelect.value;
                await alasql.promise(`USE ${newDB}`);
                this.currentDB = newDB;
                await this.saveDatabase();
                new Notice(`Switched to: ${newDB}`);
            };

            const newDbBtn = dbControls.createEl("button", { cls: "mysql-btn", text: "+" });
            newDbBtn.title = "New Database";
            newDbBtn.onclick = () => {
                new NewDatabaseModal(this.app, async (name) => {
                    try {
                        // Sanitize
                        name = name.replace(/[^a-zA-Z0-9_]/g, "");
                        if (!name) return;

                        await alasql.promise(`CREATE DATABASE IF NOT EXISTS ${name}`);
                        await alasql.promise(`USE ${name}`);
                        this.currentDB = name;
                        await this.saveDatabase();
                        refreshDBs();
                        // Update select visually as well for this instance
                        dbSelect.value = name;
                        new Notice(`Created & Switched to: ${name}`);
                    } catch (e) { new Notice("Error: " + e.message); }
                }).open();
            };

            const resetButton = controls.createEl("button", { cls: "mysql-reset-btn" });
            resetButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg> Reset`;

            const exportButton = controls.createEl("button", { cls: "mysql-btn" });
            exportButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Save`;

            const exportCsvBtn = controls.createEl("button", { cls: "mysql-btn" });
            exportCsvBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Exp CSV`;

            const importCsvBtn = controls.createEl("button", { cls: "mysql-btn" });
            importCsvBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Imp CSV`;

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

                    // Parameter Substitution (AlaSQL supports :param syntax if passed as object!)
                    // Note: AlaSQL's promise signature: alasql.promise(sql, [params])
                    // If we pass an object params, it should map :key to value.

                    const result = await alasql.promise(cleanedCode, [paramValues]);

                    // Auto-save logic
                    // Sync UI if USE command was executed manually
                    const useMatch = cleanedCode.match(/USE\s+([a-zA-Z0-9_]+)/i);
                    if (useMatch && useMatch[1]) {
                        const newDB = useMatch[1];
                        if (alasql.databases[newDB]) {
                            this.currentDB = newDB;
                            dbSelect.value = newDB; // Update Dropdown
                            // If dropdown doesn't have it (e.g. created via SQL), refresh options
                            if (dbSelect.value !== newDB) {
                                refreshDBs();
                                dbSelect.value = newDB;
                            }
                            new Notice(`Switched to: ${newDB}`);
                        }
                    }

                    if (!cleanedCode.trim().toUpperCase().startsWith('SELECT') && !cleanedCode.trim().toUpperCase().startsWith('SHOW')) {
                        await this.saveDatabase();
                        new Notice('SQL executed & saved!');
                    }

                    // Check for ignored patterns to display warning in results
                    const ignoredPatterns = [
                        { regex: /(CHARACTER SET|CHARSET)\s*=?\s*[\w\d_]+/i, name: "Character Set" },
                        { regex: /COLLATE\s*=?\s*[\w\d_]+/i, name: "Collation" },
                        { regex: /ENGINE\s*=?\s*[\w\d_]+/i, name: "Storage Engine" },
                        { regex: /LOCK\s+TABLES/i, name: "Lock Tables" }
                    ];

                    const foundIgnored = ignoredPatterns.filter(p => p.regex.test(code));
                    if (foundIgnored.length > 0) {
                        const ignoredNames = foundIgnored.map(p => p.name).join(", ");
                        const warnDiv = resultContainer.createEl("div");
                        warnDiv.style.color = "var(--text-warning)";
                        warnDiv.style.marginBottom = "10px";
                        warnDiv.style.borderLeft = "4px solid var(--text-warning)";
                        warnDiv.style.paddingLeft = "8px";
                        warnDiv.innerText = `⚠️ MySQL Compatibility: The following settings were ignored: ${ignoredNames}`;
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

            exportCsvBtn.onclick = async () => {
                new TableSelectionModal(this.app, async (tableName) => {
                    await this.exportTableToCSV(tableName);
                }).open();
            };

            importCsvBtn.onclick = async () => {
                new CSVSelectionModal(this.app, async (file) => {
                    await this.importCSVToTable(file);
                    // Refresh if tables view is open? 
                    new Notice(`Imported ${file.basename} into table '${file.basename}'`);
                }).open();
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
        if (data && data.databases) {
            try {
                const activeDB = data.currentDB || 'empresa';

                // Restore
                for (const [dbName, content] of Object.entries(data.databases)) {
                    const db = content as any;
                    // Strict: Ensure we have the expected structure
                    if (!db.tables && !db.schema) continue;

                    await alasql.promise(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
                    await alasql.promise(`USE ${dbName}`);

                    const tables = db.tables || {};
                    const schemas = db.schema || {};

                    // 1. Restore via Schema first
                    for (const [tableName, sql] of Object.entries(schemas)) {
                        try {
                            await alasql.promise(`DROP TABLE IF EXISTS ${tableName}`);
                            await alasql.promise(String(sql)); // Execute CREATE TABLE
                        } catch (e) {
                            console.error(`Error restoring schema for ${tableName}:`, e);
                        }
                    }

                    // 2. Load Data
                    for (const [tableName, rows] of Object.entries(tables)) {
                        const tableRef = tableName;
                        const rowData = rows as any[];

                        // Check if table exists (created by schema)
                        const exists = await alasql.promise(`SHOW TABLES LIKE '${tableRef}'`) as any[];

                        if (exists.length > 0) {
                            // Table exists, just insert data
                            if (rowData.length > 0) {
                                try {
                                    await alasql.promise(`INSERT INTO ${tableRef} SELECT * FROM ?`, [rowData]);
                                } catch (insertErr) {
                                    console.error(`Error populating ${tableRef}:`, insertErr);
                                }
                            }
                        } else {
                            // Fallback: Create generic table if no schema was saved
                            await alasql.promise(`CREATE TABLE ${tableRef} (temp INT)`);
                            if (rowData.length > 0) {
                                await alasql.promise(`SELECT * INTO ${tableRef} FROM ?`, [rowData]);
                            }
                            await alasql.promise(`ALTER TABLE ${tableRef} DROP COLUMN temp`);
                        }
                    }
                }

                // Restore Active Context
                if (alasql.databases[activeDB]) {
                    await alasql.promise(`USE ${activeDB}`);
                    this.currentDB = activeDB;
                }

                console.log("MySQL Plugin: Database restored (Strict Mode).");
            } catch (e) {
                console.error("MySQL Plugin: Error loading database", e);
            }
        }
    }

    async saveDatabase() {
        try {
            const currentUseId = alasql.useid;
            const databases = alasql.databases;
            const dataToSave: any = {
                currentDB: currentUseId,
                databases: {}
            };

            for (const dbName of Object.keys(databases)) {
                if (dbName === 'alasql') continue;

                await alasql.promise(`USE ${dbName}`);
                const tables = await alasql.promise("SHOW TABLES");

                const dbData: any = {};
                const dbSchema: any = {};

                for (const table of tables) {
                    const tableName = table.tableid;

                    // Save Data
                    const rows = await alasql.promise(`SELECT * FROM ${tableName}`) as any[];
                    dbData[tableName] = rows;

                    // Save Schema
                    try {
                        const createRes = await alasql.promise(`SHOW CREATE TABLE ${tableName}`) as any[];
                        // alasql returns object like { Table: 'name', 'Create Table': '...' }
                        if (createRes && createRes.length > 0) {
                            let createSQL = createRes[0]["Create Table"] || createRes[0]["CreateTable"]; // potential casing diffs
                            if (createSQL) {
                                // Clean up the SQL slightly for portability if needed, 
                                // but usually taking it raw is best for restoration.
                                dbSchema[tableName] = createSQL;
                            }
                        }
                    } catch (schemaErr) {
                        // Not critical, fallback to data-only
                    }
                }

                dataToSave.databases[dbName] = {
                    tables: dbData,
                    schema: dbSchema
                };
            }

            // Restore context
            if (currentUseId && alasql.databases[currentUseId]) {
                await alasql.promise(`USE ${currentUseId}`);
            }

            await this.saveData(dataToSave);
            console.log("MySQL Plugin: Database saved to disk (v1.2 Schema).");
        } catch (e) {
            console.error("MySQL Plugin: Error saving database", e);
        }
    }

    async exportTableToCSV(tableName: string) {
        try {
            const data = await alasql.promise(`SELECT * FROM ${tableName}`) as any[];
            if (!data || data.length === 0) {
                new Notice(`Table '${tableName}' is empty.`);
                return;
            }

            // Convert to CSV
            const keys = Object.keys(data[0]);
            const csvRows = [keys.join(",")]; // Header

            for (const row of data) {
                const values = keys.map(k => {
                    let val = row[k];
                    if (val === null || val === undefined) return "";
                    val = String(val);
                    // Escape quotes and wrap in quotes if contains comma
                    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
                        return `"${val.replace(/"/g, '""')}"`;
                    }
                    return val;
                });
                csvRows.push(values.join(","));
            }
            const csvContent = csvRows.join("\n");

            // Save to Vault
            const folderPath = "sql-exports";
            if (!this.app.vault.getAbstractFileByPath(folderPath)) {
                await this.app.vault.createFolder(folderPath);
            }

            const filePath = `${folderPath}/${tableName}.csv`;
            const existingFile = this.app.vault.getAbstractFileByPath(filePath);

            if (existingFile instanceof TFile) {
                new Notice(`Overwriting ${filePath}`);
                await this.app.vault.modify(existingFile, csvContent);
            } else {
                await this.app.vault.create(filePath, csvContent);
            }
            new Notice(`Exported to ${filePath}`);
        } catch (e) {
            new Notice("Export failed: " + e.message);
            console.error(e);
        }
    }

    async importCSVToTable(file: TFile) {
        try {
            const content = await this.app.vault.read(file);
            const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
            if (lines.length < 2) throw new Error("CSV file is empty or has no data");

            // Parse Header
            const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ''));

            const data = [];
            for (let i = 1; i < lines.length; i++) {
                const rowStr = lines[i];
                const rowValues: string[] = [];
                let inQuote = false;
                let currentVal = "";
                for (let char of rowStr) {
                    if (char === '"') { inQuote = !inQuote; continue; }
                    if (char === ',' && !inQuote) {
                        rowValues.push(currentVal);
                        currentVal = "";
                    } else {
                        currentVal += char;
                    }
                }
                rowValues.push(currentVal);

                if (rowValues.length !== headers.length) continue;

                const rowObj: any = {};
                headers.forEach((h, idx) => {
                    const val = rowValues[idx];
                    const num = Number(val);
                    rowObj[h] = isNaN(num) ? val : num;
                });
                data.push(rowObj);
            }

            const tableName = file.basename.replace(/[^a-zA-Z0-9_]/g, "_");

            if (data.length > 0) {
                await alasql.promise(`DROP TABLE IF EXISTS ${tableName}`);
                await alasql.promise(`CREATE TABLE ${tableName} (temp INT)`);
                await alasql.promise(`SELECT * INTO ${tableName} FROM ?`, [data]);
                await alasql.promise(`ALTER TABLE ${tableName} DROP COLUMN temp`);
            }

            await this.saveDatabase();
            new Notice(`Imported ${data.length} rows into '${tableName}'`);

        } catch (e) {
            new Notice("Import failed: " + e.message);
            console.error(e);
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
            section.createEl("h6", { text: `Result #${index + 1} `, cls: "mysql-result-title" });
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
            section.createEl("p", { text: `Query executed.Affected rows: ${data} `, cls: "mysql-metadata" });
            return;
        }

        if (typeof data === 'object') {
            section.createEl("p", { text: `Result: ${JSON.stringify(data)} `, cls: "mysql-metadata" });
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
        keys.forEach(key => headerRow.createEl("th", { text: key }));

        // Body
        const tbody = table.createEl("tbody");

        // Lazy Loading / Pagination State
        const batchSize = 50;
        let currentCount = 0;

        // Render first batch
        const initialBatch = rows.slice(0, batchSize);
        initialBatch.forEach(row => {
            const tr = tbody.createEl("tr");
            keys.forEach(key => {
                const val = row[key];
                tr.createEl("td", { text: val === null || val === undefined ? "NULL" : String(val) });
            });
        });
        currentCount += initialBatch.length;

        // Controls logic
        if (rows.length > batchSize) {
            const controls = el.createEl("div", { cls: "mysql-pagination-controls" });
            const status = controls.createEl("span", { cls: "mysql-pagination-status" });

            const loadMoreBtn = controls.createEl("button", { cls: "mysql-btn", text: "Load More (50)" });
            const loadAllBtn = controls.createEl("button", { cls: "mysql-btn", text: "Load All" });

            const updateControls = () => {
                status.setText(`Showing ${currentCount} of ${rows.length} rows`);
                if (currentCount >= rows.length) {
                    loadMoreBtn.style.display = "none";
                    loadAllBtn.style.display = "none";
                }
            };

            // Initial update
            updateControls();

            // Handlers
            loadMoreBtn.onclick = () => {
                const nextBatch = rows.slice(currentCount, currentCount + batchSize);
                nextBatch.forEach(row => {
                    const tr = tbody.createEl("tr");
                    keys.forEach(key => {
                        const val = row[key];
                        tr.createEl("td", { text: val === null || val === undefined ? "NULL" : String(val) });
                    });
                });
                currentCount += nextBatch.length;
                updateControls();
            };

            loadAllBtn.onclick = () => {
                const rest = rows.slice(currentCount);
                rest.forEach(row => {
                    const tr = tbody.createEl("tr");
                    keys.forEach(key => {
                        const val = row[key];
                        tr.createEl("td", { text: val === null || val === undefined ? "NULL" : String(val) });
                    });
                });
                currentCount = rows.length;
                updateControls();
            };
        }
    }

    renderError(error: any, el: HTMLElement) {
        const errDiv = el.createEl("div");
        errDiv.addClass("mysql-error");
        errDiv.createEl("strong", { text: "SQL Error: " });
        errDiv.createEl("span", { text: error.message || String(error) });
    }
}

class TableSelectionModal extends FuzzySuggestModal<string> {
    callback: (item: string) => void;

    constructor(app: App, callback: (item: string) => void) {
        super(app);
        this.callback = callback;
    }

    getItems(): string[] {
        const res = alasql("SHOW TABLES") as any[];
        if (!res) return [];
        return res.map((r: any) => r.tableid);
    }

    getItemText(item: string): string {
        return item;
    }

    onChooseItem(item: string, evt: MouseEvent | KeyboardEvent): void {
        this.callback(item);
    }
}

class CSVSelectionModal extends FuzzySuggestModal<TFile> {
    callback: (item: TFile) => void;

    constructor(app: App, callback: (item: TFile) => void) {
        super(app);
        this.callback = callback;
    }

    getItems(): TFile[] {
        return this.app.vault.getFiles().filter(f => f.extension === "csv");
    }

    getItemText(item: TFile): string {
        return item.path;
    }

    onChooseItem(item: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.callback(item);
    }
}

class NewDatabaseModal extends Modal {
    onSubmit: (result: string) => void;

    constructor(app: App, onSubmit: (result: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h2", { text: "Create New Database" });

        const inputDiv = contentEl.createEl("div");
        const input = inputDiv.createEl("input", { type: "text", placeholder: "Database Name" });
        input.style.width = "100%";
        input.focus();

        const btnDiv = contentEl.createEl("div");
        btnDiv.style.marginTop = "1rem";
        btnDiv.style.display = "flex";
        btnDiv.style.justifyContent = "flex-end";

        const btn = btnDiv.createEl("button", { text: "Create", cls: "mod-cta" });
        btn.onclick = () => {
            this.close();
            this.onSubmit(input.value);
        };

        input.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                this.close();
                this.onSubmit(input.value);
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
