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
            text: "We noticed you're switching databases via the UI. While this is great for quick navigation, we'd like to share a professional tip: using the explicit `USE` command in your scripts can make your workflow even more robust."
        });

        const quote = body.createEl("blockquote", { cls: "mysql-pro-quote" });
        quote.createEl("p", {
            text: "Explicitly defining your context is a best practice that ensures your scripts are portable and unambiguous across different environments:"
        });
        const codeBlock = quote.createDiv({ cls: "mysql-pro-code-examples" });
        codeBlock.createEl("code", { text: "USE staging;" });
        codeBlock.createEl("code", { text: "USE production;" });

        body.createEl("p", {
            text: "Defining the context within the code helps avoid confusion and makes your intent clear to anyone reviewing your work. You can always continue using the global switcher for convenience!"
        });

        const punchline = body.createEl("div", { cls: "mysql-pro-punchline" });
        punchline.createSpan({ text: "Happy querying! 🚀" });

        const signature = contentEl.createDiv({ cls: "mysql-pro-signature" });
        const sigLogo = signature.createDiv({ cls: "mysql-pro-signature-logo" });
        setIcon(sigLogo, "circle");

        const sigText = signature.createDiv({ cls: "mysql-pro-signature-text" });
        sigText.createEl("p", { text: "Best regards," });
        sigText.createEl("p", { text: "SQL Notebook Development Team", cls: "mysql-pro-team" });

        const btnContainer = contentEl.createDiv({ cls: "mysql-modal-buttons" });
        const closeBtn = btnContainer.createEl("button", { text: "Mark as Read", cls: "mod-cta" });
        closeBtn.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
