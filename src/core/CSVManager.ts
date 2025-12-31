import { TFile, Notice } from 'obsidian';
// @ts-ignore
import alasql from 'alasql';
import { IMySQLPlugin, AlaSQLInstance } from '../types';
import { SQLSanitizer } from '../utils/SQLSanitizer';

export class CSVManager {
    constructor(private plugin: IMySQLPlugin) { }

    async importCSV(file: TFile): Promise<boolean> {
        try {
            // 3.1 Check file size (limit 20MB)
            if (file.stat.size > 20 * 1024 * 1024) {
                new Notice(`File too large (${(file.stat.size / 1024 / 1024).toFixed(2)} MB). Limit is 20MB.`);
                return false;
            }

            const content = await this.plugin.app.vault.read(file);
            if (!content) {
                new Notice("CSV file is empty");
                return false;
            }

            const tableName = SQLSanitizer.sanitizeIdentifier(file.basename);

            // 3.2 Streaming/Chunking
            const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length === 0) return false;

            // Extract headers from first line
            const headers = lines[0].split(',').map(h => h.trim());
            const dataLines = lines.slice(1);

            // Create table
            await alasql.promise(`DROP TABLE IF EXISTS ${tableName}`);
            await alasql.promise(`CREATE TABLE ${tableName}`);

            // Batch insert
            const BATCH_SIZE = 5000;

            for (let i = 0; i < dataLines.length; i += BATCH_SIZE) {
                const batchLines = dataLines.slice(i, i + BATCH_SIZE);
                // Parse CSV chunk
                const batchData = (alasql as unknown as AlaSQLInstance)(`SELECT * FROM CSV(?, {headers:false})`, [batchLines.join('\n')]) as unknown[][];

                // Map array results to objects using headers
                const mappedData = batchData.map((row: unknown[]) => {
                    const obj: Record<string, unknown> = {};
                    headers.forEach((h, idx) => obj[h] = row[idx]);
                    return obj;
                });

                await alasql.promise(`INSERT INTO ${tableName} SELECT * FROM ?`, [mappedData]);

                // Optional: Update progress silently
            }

            new Notice(`Successfully imported ${dataLines.length} rows into table '${tableName}'`);
            return true;
        } catch (error) {
            console.error("CSV Import Error:", error);
            new Notice(`Import failed: ${(error as Error).message}`);
            return false;
        }
    }

    async exportTable(tableName: string): Promise<void> {
        try {
            const data = await (alasql as unknown as AlaSQLInstance).promise<unknown[]>(`SELECT * FROM ${tableName}`);
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
            new Notice(`Export failed: ${(error as Error).message}`);
        }
    }

    private jsonToCSV(data: unknown[]): string {
        if (data.length === 0) return '';
        const keys = Object.keys(data[0]);
        const header = keys.join(',') + '\n';
        const rows = data.map(row =>
            keys.map(k => {
                const val = (row as Record<string, unknown>)[k];
                if (val === null || val === undefined) return '';
                const str = (typeof val === 'object' && val !== null) ? JSON.stringify(val) : String(val as string | number | boolean);
                // Quote if contains comma, quote or newline
                if (str.match(/[,"]/)) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(',')
        );
        return header + rows.join('\n');
    }
}
