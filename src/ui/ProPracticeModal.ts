import { Modal, App, setIcon } from "obsidian";

export class ProPracticeModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass("mysql-pro-practice-modal");

        contentEl.createEl("h2", { text: "🧙‍♂️ Pro Practice Alert" });

        const body = contentEl.createDiv({ cls: "mysql-pro-practice-body" });

        body.createEl("p", {
            text: "Ei, percebi que você tentou clicar no banco de dados para trocar o contexto. No modo LIVE nós facilitamos as coisas, mas aqui no Workbench, gostamos de manter as coisas... puras."
        });

        const quote = body.createEl("blockquote", { cls: "mysql-pro-quote" });
        quote.createEl("p", {
            text: "Em um ambiente de desenvolvimento real, o controle é seu. Incentivamos fortemente o uso do comando `USE` diretamente no seu SQL para alternar entre contextos."
        });
        quote.createEl("code", { text: "USE empresa;" });

        body.createEl("p", {
            text: "É mais rápido, é mais profissional e mantém seu script auto-contido. Se você for do tipo que prefere cliques, pode trocar o banco global nas configurações do plugin, mas lembre-se: "
        });

        const punchline = body.createEl("div", { cls: "mysql-pro-punchline" });
        punchline.createSpan({ text: "No pain, no gain. 💪💻" });

        const btnContainer = contentEl.createDiv({ cls: "mysql-modal-buttons" });
        const closeBtn = btnContainer.createEl("button", { text: "Entendido, mestre", cls: "mod-cta" });
        closeBtn.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
