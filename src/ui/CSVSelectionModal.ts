import { App, FuzzySuggestModal, TFile } from 'obsidian';

export class CSVSelectionModal extends FuzzySuggestModal<TFile> {
    constructor(app: App, private onChoose: (file: TFile) => void) {
        super(app);
    }

    getItems(): TFile[] {
        return this.app.vault.getFiles().filter(f => f.extension.toLowerCase() === 'csv');
    }

    getItemText(item: TFile): string {
        return item.path;
    }

    onChooseItem(item: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.onChoose(item);
    }
}
