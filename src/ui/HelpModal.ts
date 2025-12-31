import { Modal, App, setIcon, Setting } from "obsidian";
import { t } from "../utils/i18n";

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

        new Setting(contentEl).setName(t('help.title')).setHeading();

        const features: Feature[] = [
            {
                icon: "chevron-down",
                title: t('help.collapsible_title'),
                description: t('help.collapsible_desc')
            },
            {
                icon: "at-sign",
                title: t('help.auto_collapse_title'),
                description: t('help.auto_collapse_desc'),
                example: "-- @ Initial Setup"
            },
            {
                icon: "alert-triangle",
                title: t('help.alert_title'),
                description: t('help.alert_desc'),
                example: "-- ! DROP TABLE users"
            },
            {
                icon: "help-circle",
                title: t('help.question_title'),
                description: t('help.question_desc'),
                example: "-- ? optimizing join"
            },
            {
                icon: "star",
                title: t('help.favorite_title'),
                description: t('help.favorite_desc'),
                example: "-- * Production Report"
            },
            {
                icon: "copy",
                title: t('help.copy_edit_title'),
                description: t('help.copy_edit_desc')
            }
        ];

        const list = contentEl.createDiv({ cls: "mysql-help-list" });

        features.forEach(feature => {
            const item = list.createDiv({ cls: "mysql-help-item" });

            const iconContainer = item.createDiv({ cls: "mysql-help-icon" });
            setIcon(iconContainer, feature.icon);

            const content = item.createDiv({ cls: "mysql-help-content" });
            new Setting(content).setName(feature.title).setHeading();
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
