import { App, Modal, setIcon, ButtonComponent } from 'obsidian';

export class ConfirmationModal extends Modal {
    private onSubmit: (result: boolean) => void;
    private titleText: string;
    private message: string;
    private confirmText: string;
    private cancelText: string;

    constructor(
        app: App,
        title: string,
        message: string,
        onSubmit: (result: boolean) => void,
        confirmText: string = "Confirm",
        cancelText: string = "Cancel"
    ) {
        super(app);
        this.titleText = title;
        this.message = message;
        this.onSubmit = onSubmit;
        this.confirmText = confirmText;
        this.cancelText = cancelText;
    }

    onOpen() {
        const { contentEl } = this;

        // Modal Container Class
        this.modalEl.addClass("mysql-confirmation-modal");

        // Header with Icon
        const header = contentEl.createDiv({ cls: "mysql-modal-header" });
        const iconContainer = header.createDiv({ cls: "mysql-modal-icon" });
        setIcon(iconContainer, "alert-triangle");
        header.createEl("h2", { text: this.titleText, cls: "mysql-modal-title" });

        // Body
        contentEl.createEl("p", { text: this.message, cls: "mysql-modal-body" });

        // Buttons
        const buttonsGroup = contentEl.createDiv({ cls: "mysql-modal-footer" });

        const cancelBtn = new ButtonComponent(buttonsGroup)
            .setButtonText(this.cancelText)
            .onClick(() => this.close());
        cancelBtn.buttonEl.addClass("mysql-modal-btn-cancel");

        const confirmBtn = new ButtonComponent(buttonsGroup)
            .setButtonText(this.confirmText)
            .setWarning()
            .onClick(() => {
                this.onSubmit(true);
                this.close();
            });
        confirmBtn.buttonEl.addClass("mysql-modal-btn-confirm");
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
