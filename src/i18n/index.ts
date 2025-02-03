import { moment } from 'obsidian';
import zhCN from './zh-CN';
import en from './en';

const localeMap: { [key: string]: any } = {
    'zh': zhCN,
    'zh-cn': zhCN,
    'en': en,
    'en-us': en,
    'en-gb': en,
};

let currentLocale = 'en';

export function setLocale(locale: string) {
    const normalizedLocale = locale.toLowerCase();
    if (localeMap[normalizedLocale]) {
        currentLocale = normalizedLocale;
        moment.locale(normalizedLocale);
    }
}

export function getCurrentLocale(): string {
    return currentLocale;
}

export function t(key: string): string {
    const translations = localeMap[currentLocale] || localeMap['en'];
    return translations[key] || localeMap['en'][key] || key;
} 