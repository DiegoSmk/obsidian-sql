import { Modal, App, setIcon } from "obsidian";

export class ProPracticeModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl, modalEl } = this;
        modalEl.addClass("mysql-email-modal-container");
        contentEl.addClass("mysql-pro-practice-modal");
        contentEl.addClass("mysql-email-theme");

        // Email Header Section
        const emailHeader = contentEl.createDiv({ cls: "mysql-email-header" });

        const fromRow = emailHeader.createDiv({ cls: "mysql-email-row" });
        fromRow.createSpan({ text: "From:", cls: "mysql-email-label" });
        fromRow.createSpan({ text: "SQL Notebook Dev Team <dev@obsidian-sql.internal>", cls: "mysql-email-value" });

        const toRow = emailHeader.createDiv({ cls: "mysql-email-row" });
        toRow.createSpan({ text: "To:", cls: "mysql-email-label" });
        toRow.createSpan({ text: "Valued Developer", cls: "mysql-email-value" });

        const subjectRow = emailHeader.createDiv({ cls: "mysql-email-row" });
        subjectRow.createSpan({ text: "Subject:", cls: "mysql-email-label" });
        subjectRow.createSpan({ text: "Pro Practice Alert: Database Context Best Practices", cls: "mysql-email-value mysql-email-subject" });

        const body = contentEl.createDiv({ cls: "mysql-pro-practice-body" });

        body.createEl("p", {
            text: "Hello,"
        });

        body.createEl("p", {
            text: "It looks like you're trying to switch databases via UI. While LIVE blocks provide a convenient switcher for dashboards, we encourage a more direct approach here in the Workbench."
        });

        const quote = body.createEl("blockquote", { cls: "mysql-pro-quote" });
        quote.createEl("p", {
            text: "In a professional development environment, explicit context is king. Use the `USE` command to switch between your environments safely:"
        });
        const codeBlock = quote.createDiv({ cls: "mysql-pro-code-examples" });
        codeBlock.createEl("code", { text: "USE staging;" });
        codeBlock.createEl("code", { text: "USE production;" });

        body.createEl("p", {
            text: "Explicitly defined context makes your scripts portable and avoids ambiguity. If you still prefer a global switch, you can change the active database in the plugin settings."
        });

        const punchline = body.createEl("div", { cls: "mysql-pro-punchline" });
        punchline.createSpan({ text: "Remember: No pain, no gain. 💪" });

        const signature = contentEl.createDiv({ cls: "mysql-pro-signature" });
        signature.createEl("p", { text: "Best regards," });
        signature.createEl("p", { text: "SQL Notebook Development Team", cls: "mysql-pro-team" });

        const btnContainer = contentEl.createDiv({ cls: "mysql-modal-buttons" });
        const closeBtn = btnContainer.createEl("button", { text: "Mark as Read", cls: "mod-cta" });
        closeBtn.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
