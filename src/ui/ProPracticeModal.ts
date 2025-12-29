import { Modal, App, setIcon } from "obsidian";

export class ProPracticeModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass("mysql-pro-practice-modal");

        const header = contentEl.createDiv({ cls: "mysql-pro-header" });
        const iconEl = header.createDiv({ cls: "mysql-pro-icon" });
        setIcon(iconEl, "terminal");
        header.createEl("h2", { text: "Pro Practice Alert" });

        const body = contentEl.createDiv({ cls: "mysql-pro-practice-body" });

        body.createEl("p", {
            text: "It looks like you're trying to switch databases via UI. While LIVE blocks provide a convenient switcher for dashboards, we encourage a more direct approach here in the Workbench."
        });

        const quote = body.createEl("blockquote", { cls: "mysql-pro-quote" });
        quote.createEl("p", {
            text: "In a professional development environment, explicit context is king. Use the `USE` command to switch between your environments safely:"
        });
        const codeBlock = quote.createDiv({ cls: "mysql-pro-code-examples" });
        codeBlock.createEl("code", { text: "USE staging;" });
        codeBlock.createEl("br");
        codeBlock.createEl("code", { text: "USE production;" });

        body.createEl("p", {
            text: "Explicitly defined context makes your scripts portable and avoids ambiguity. If you still prefer a global switch, you can change the active database in the plugin settings, but remember:"
        });

        const punchline = body.createEl("div", { cls: "mysql-pro-punchline" });
        punchline.createSpan({ text: "No pain, no gain. 💪" });

        const signature = contentEl.createDiv({ cls: "mysql-pro-signature" });
        signature.createEl("p", { text: "Signed," });
        signature.createEl("p", { text: "SQL Notebook Development Team", cls: "mysql-pro-team" });

        const btnContainer = contentEl.createDiv({ cls: "mysql-modal-buttons" });
        const closeBtn = btnContainer.createEl("button", { text: "Understood", cls: "mod-cta" });
        closeBtn.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
