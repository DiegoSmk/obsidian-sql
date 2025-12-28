import { Modal, App, setIcon } from "obsidian";

interface Feature {
    icon: string;
    title: string;
    description: string;
    example?: string;
}

export class HelpModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass("mysql-help-modal");

        contentEl.createEl("h2", { text: "SQL Notebook Features" });

        const features: Feature[] = [
            {
                icon: "chevron-down",
                title: "Collapsible Workbench",
                description: "Toggle the workbench view to save space. Click the header or the chevron icon."
            },
            {
                icon: "at-sign",
                title: "Auto-Collapse",
                description: "Start a comment with '@' (e.g., '-- @ My Query') to automatically collapse the workbench when the note opens.",
                example: "-- @ Initial Setup"
            },
            {
                icon: "alert-triangle",
                title: "Alert Marker (!)",
                description: "Add '!' to your comment start to highlight it as an alert or warning.",
                example: "-- ! DROP TABLE users"
            },
            {
                icon: "help-circle",
                title: "Question Marker (?)",
                description: "Add '?' to indicate a query that needs review or is experimental.",
                example: "-- ? optimizing join"
            },
            {
                icon: "star",
                title: "Favorite Marker (*)",
                description: "Add '*' to highlight important or frequently used queries.",
                example: "-- * Production Report"
            },
            {
                icon: "copy",
                title: "Copy & Edit",
                description: "Hover over the workbench to access quick Copy Code and Edit Block buttons."
            }
        ];

        const list = contentEl.createDiv({ cls: "mysql-help-list" });

        features.forEach(feature => {
            const item = list.createDiv({ cls: "mysql-help-item" });

            const iconContainer = item.createDiv({ cls: "mysql-help-icon" });
            setIcon(iconContainer, feature.icon);

            const content = item.createDiv({ cls: "mysql-help-content" });
            content.createEl("h3", { text: feature.title });
            content.createDiv({ cls: "mysql-help-desc", text: feature.description });

            if (feature.example) {
                content.createEl("code", { cls: "mysql-help-example", text: feature.example });
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
