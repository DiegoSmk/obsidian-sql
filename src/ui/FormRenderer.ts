import { App, Notice, setIcon } from 'obsidian';
import { IMySQLPlugin } from '../types';
import { QueryExecutor } from '../core/QueryExecutor';
import { SQLSanitizer } from '../utils/SQLSanitizer';

export interface FormField {
    name: string;
    type: string;
    label: string;
    required: boolean;
    defaultValue?: any;
    options?: string[];
    isPrimaryKey: boolean;
    isAutoIncrement: boolean;
}

export interface FormData {
    tableName: string;
    baseTableName: string;
    fields: FormField[];
}

export class FormRenderer {
    static render(data: FormData, container: HTMLElement, app: App, plugin: IMySQLPlugin): void {
        const formWrapper = container.createDiv({ cls: "mysql-form-wrapper" });

        const header = formWrapper.createDiv({ cls: "mysql-form-header" });
        setIcon(header, "file-edit");
        header.createSpan({ text: `Insert into ${data.baseTableName}`, cls: "mysql-form-title" });

        const form = formWrapper.createEl("form", { cls: "mysql-form" });
        const fieldInputs: Record<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> = {};

        data.fields.forEach(field => {
            if (field.isAutoIncrement) return;

            const fieldRow = form.createDiv({ cls: "mysql-form-row" });
            const label = fieldRow.createEl("label", { text: field.label });
            if (field.required) label.createSpan({ text: "*", cls: "mysql-required-star" });

            let input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

            if (field.options && field.options.length > 0) {
                const select = fieldRow.createEl("select");
                field.options.forEach(opt => {
                    select.createEl("option", { text: opt, value: opt });
                });
                input = select;
            } else if (field.type === 'CHECKBOX') {
                const check = fieldRow.createEl("input", { type: "checkbox" });
                input = check;
            } else if (field.type === 'NUMBER') {
                input = fieldRow.createEl("input", { type: "number" });
            } else if (field.type === 'DATE') {
                input = fieldRow.createEl("input", { type: "date" });
            } else {
                input = fieldRow.createEl("input", { type: "text" });
            }

            if (field.required) input.setAttr("required", "true");

            if (field.defaultValue !== undefined && field.defaultValue !== null) {
                const cleanDefault = String(field.defaultValue).replace(/^'|'$/g, '');
                if (input instanceof HTMLInputElement && input.type === 'checkbox') {
                    (input as HTMLInputElement).checked = cleanDefault === 'true' || cleanDefault === '1';
                } else {
                    input.value = cleanDefault;
                }
            }

            fieldInputs[field.name] = input;
        });

        const statusMsg = formWrapper.createDiv({ cls: "mysql-form-status" });
        statusMsg.style.display = "none";

        const footer = formWrapper.createDiv({ cls: "mysql-form-footer" });
        const submitBtn = footer.createEl("button", { cls: "mysql-btn mysql-form-submit-btn", type: "button" });
        setIcon(submitBtn, "save");
        submitBtn.createSpan({ text: "Save Record" });

        const clearBtn = footer.createEl("button", { cls: "mysql-btn", type: "button", text: "Clear" });

        submitBtn.onclick = async () => {
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            await this.handleSave(data, fieldInputs, submitBtn, statusMsg, form, plugin);
        };

        clearBtn.onclick = () => {
            form.reset();
            statusMsg.style.display = "none";
        };
    }

    private static async handleSave(
        data: FormData,
        inputs: Record<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
        btn: HTMLButtonElement,
        statusMsg: HTMLElement,
        form: HTMLFormElement,
        plugin: IMySQLPlugin
    ): Promise<void> {
        btn.disabled = true;
        const originalText = btn.innerText;
        btn.innerText = "Saving...";
        statusMsg.style.display = "none";

        try {
            const values: Record<string, any> = {};
            for (const [name, input] of Object.entries(inputs)) {
                if (input instanceof HTMLInputElement && input.type === 'checkbox') {
                    values[name] = input.checked ? 1 : 0;
                } else if (input instanceof HTMLInputElement && input.type === 'number') {
                    values[name] = input.value === "" ? null : Number(input.value);
                } else {
                    values[name] = input.value;
                }
            }

            const cols = Object.keys(values).join(', ');
            const placeholders = Object.keys(values).map(() => '?').join(', ');
            const sql = `INSERT INTO ${data.tableName} (${cols}) VALUES (${placeholders})`;
            const params = Object.values(values).map(v => v === "" ? null : v);

            const result = await QueryExecutor.execute(sql, params, {
                activeDatabase: plugin.activeDatabase,
                originId: 'form-submission'
            });

            if (result.success) {
                statusMsg.textContent = `✓ Saved successfully to ${data.baseTableName}`;
                statusMsg.className = "mysql-form-status success";
                statusMsg.style.display = "block";
                form.reset();
                new Notice(`Record saved to ${data.baseTableName}`);
            } else {
                statusMsg.textContent = `❌ Error: ${result.error}`;
                statusMsg.className = "mysql-form-status error";
                statusMsg.style.display = "block";
                new Notice(`Error saving record: ${result.error}`);
            }
        } catch (e) {
            statusMsg.textContent = `❌ Unexpected Error: ${e.message}`;
            statusMsg.className = "mysql-form-status error";
            statusMsg.style.display = "block";
        } finally {
            btn.disabled = false;
            btn.innerHTML = "";
            setIcon(btn, "save");
            btn.createSpan({ text: "Save Record" });
        }
    }
}
