import en from '../locales/en';
import ptBR from '../locales/pt-BR';
import zh from '../locales/zh';
import { Language } from '../types';

const locales: Record<Language, any> = {
    'en': en,
    'pt-BR': ptBR,
    'zh': zh
};

let currentLanguage: Language = 'en';

export function setLanguage(lang: Language) {
    currentLanguage = lang;
}

export function t(keyPath: string, vars?: Record<string, string>): string {
    const keys = keyPath.split('.');
    let value = locales[currentLanguage];

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
            interpolated = interpolated.replace(new RegExp(`{${varName}}`, 'g'), varValue);
        }
        return interpolated;
    }

    return value;
}
