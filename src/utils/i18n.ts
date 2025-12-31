import en from '../locales/en';
import ptBR from '../locales/pt-BR';
import zh from '../locales/zh';
import es from '../locales/es';
import de from '../locales/de';
import fr from '../locales/fr';
import ja from '../locales/ja';
import ko from '../locales/ko';
import { Language } from '../types';

const locales: Record<string, unknown> = {
    'en': en,
    'pt-BR': ptBR,
    'zh': zh,
    'es': es,
    'de': de,
    'fr': fr,
    'ja': ja,
    'ko': ko
};

let currentLanguage: Language = 'en';

export function resolveLanguage(lang: Language): 'en' | 'pt-BR' | 'zh' | 'es' | 'de' | 'fr' | 'ja' | 'ko' {
    if (lang !== 'auto') return lang as unknown;

    const obsidianLang = (window.localStorage.getItem('language') || 'en').toLowerCase();

    if (obsidianLang.startsWith('pt')) return 'pt-BR';
    if (obsidianLang.startsWith('zh')) return 'zh';
    if (obsidianLang.startsWith('es')) return 'es';
    if (obsidianLang.startsWith('de')) return 'de';
    if (obsidianLang.startsWith('fr')) return 'fr';
    if (obsidianLang.startsWith('ja')) return 'ja';
    if (obsidianLang.startsWith('ko')) return 'ko';

    return 'en';
}

export function setLanguage(lang: Language) {
    currentLanguage = lang;
}

export function t(keyPath: string, vars?: Record<string, string>): string {
    const keys = keyPath.split('.');
    const resolvedLang = resolveLanguage(currentLanguage);
    let value = locales[resolvedLang];

    for (const key of keys) {
        if (!value || typeof value !== 'object') {
            // Fallback to English
            value = locales['en'];
            for (const fallbackKey of keys) {
                if (!value) break;
                value = value[fallbackKey];
            }
            break;
        }
        value = value[key];
    }

    if (typeof value !== 'string') {
        return keyPath;
    }

    if (vars) {
        let interpolated = value;
        for (const [varName, varValue] of Object.entries(vars)) {
            const sanitizedValue = String(varValue)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
            interpolated = interpolated.replace(new RegExp(`{${varName}}`, 'g'), sanitizedValue);
        }
        return interpolated;
    }

    return value;
}
