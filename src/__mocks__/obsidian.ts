import { vi } from 'vitest';

export class Plugin {
    loadData = vi.fn();
    saveData = vi.fn();
}

export class Notice {
    setMessage = vi.fn();
    hide = vi.fn();
    constructor(public message: string) { }
}

export class Events {
    private listeners: Record<string, Function[]> = {};

    on(name: string, callback: Function) {
        if (!this.listeners[name]) this.listeners[name] = [];
        this.listeners[name].push(callback);
    }

    off(name: string, callback: Function) {
        if (!this.listeners[name]) return;
        this.listeners[name] = this.listeners[name].filter(cb => cb !== callback);
    }

    trigger(name: string, ...args: any[]) {
        if (this.listeners[name]) {
            this.listeners[name].forEach(cb => cb(...args));
        }
    }
}

export const debounce = (fn: Function, wait: number) => {
    return (...args: any[]) => fn(...args);
};

export const setIcon = vi.fn();

export class Menu {
    items: any[] = [];
    addItem(cb: (item: any) => void) {
        const itemMock = {
            setTitle: vi.fn().mockReturnThis(),
            setIcon: vi.fn().mockReturnThis(),
            onClick: vi.fn().mockReturnThis(),
            setDisabled: vi.fn().mockReturnThis()
        };
        cb(itemMock);
        this.items.push(itemMock);
        return this;
    }
    showAtMouseEvent = vi.fn();
    showAtPosition = vi.fn();
}

export class Component {
    load() { }
    unload() { }
    addChild() { }
    registerEvent() { }
}

export class Modal {
    contentEl: HTMLElement;
    constructor(app: any) {
        this.contentEl = document.createElement('div');
    }
    open() { }
    close() { }
    onOpen() { }
    onClose() { }
}
