import { Modal, App, setIcon } from "obsidian";
import { t } from "../utils/i18n";

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
        fromRow.createSpan({ text: t('pro.label_from'), cls: "mysql-email-label" });
        fromRow.createSpan({ text: t('pro.from_name'), cls: "mysql-email-value" });

        const toRow = emailHeader.createDiv({ cls: "mysql-email-row" });
        toRow.createSpan({ text: t('pro.label_to'), cls: "mysql-email-label" });
        toRow.createSpan({ text: t('pro.to_name'), cls: "mysql-email-value" });

        const subjectRow = emailHeader.createDiv({ cls: "mysql-email-row" });
        subjectRow.createSpan({ text: t('pro.label_subject'), cls: "mysql-email-label" });
        subjectRow.createSpan({ text: t('pro.subject'), cls: "mysql-email-value mysql-email-subject" });

        const body = contentEl.createDiv({ cls: "mysql-pro-practice-body" });

        body.createEl("p", {
            text: t('pro.hello')
        });

        body.createEl("p", {
            text: t('pro.msg_1')
        });

        const quote = body.createEl("blockquote", { cls: "mysql-pro-quote" });
        quote.createEl("p", {
            text: t('pro.msg_quote')
        });
        const codeBlock = quote.createDiv({ cls: "mysql-pro-code-examples" });
        codeBlock.createEl("code", { text: "USE staging;" });
        codeBlock.createEl("code", { text: "USE production;" });

        body.createEl("p", {
            text: t('pro.msg_2')
        });

        const punchline = body.createEl("div", { cls: "mysql-pro-punchline" });
        punchline.createSpan({ text: t('pro.punchline') });

        const signature = contentEl.createDiv({ cls: "mysql-pro-signature" });
        const sigLogo = signature.createDiv({ cls: "mysql-pro-signature-logo" });
        setIcon(sigLogo, "circle");

        const sigText = signature.createDiv({ cls: "mysql-pro-signature-text" });
        sigText.createEl("p", { text: t('pro.signature_regards') });
        sigText.createEl("p", { text: t('pro.signature_team'), cls: "mysql-pro-team" });

        const btnContainer = contentEl.createDiv({ cls: "mysql-modal-buttons" });
        const closeBtn = btnContainer.createEl("button", { text: t('pro.btn_read'), cls: "mod-cta" });
        closeBtn.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
