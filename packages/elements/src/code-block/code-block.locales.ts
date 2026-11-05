export interface CodeBlockLocale {
    code: string;
    rtl?: boolean;
    /** Copy button label, and the same button right after a copy. */
    copy: string;
    copied: string;
    /** Fold chevron labels for blocks that opt into `collapse-scope`. */
    expandScope: string;
    collapseScope: string;
}

export const CODE_BLOCK_LOCALES: Record<string, CodeBlockLocale | undefined> & { en: CodeBlockLocale } = {
    en: { code: 'en', copy: 'Copy', copied: 'Copied', expandScope: 'Expand scope', collapseScope: 'Collapse scope' },
    he: { code: 'he', rtl: true, copy: 'העתק', copied: 'הועתק', expandScope: 'הרחב טווח', collapseScope: 'כווץ טווח' },
    ar: { code: 'ar', rtl: true, copy: 'نسخ', copied: 'تم النسخ', expandScope: 'توسيع النطاق', collapseScope: 'طي النطاق' },
    de: { code: 'de', copy: 'Kopieren', copied: 'Kopiert', expandScope: 'Bereich erweitern', collapseScope: 'Bereich einklappen' },
    fr: { code: 'fr', copy: 'Copier', copied: 'Copié', expandScope: 'Développer la portée', collapseScope: 'Réduire la portée' },
    es: { code: 'es', copy: 'Copiar', copied: 'Copiado', expandScope: 'Expandir ámbito', collapseScope: 'Contraer ámbito' },
    ja: { code: 'ja', copy: 'コピー', copied: 'コピーしました', expandScope: 'スコープを展開', collapseScope: 'スコープを折りたたむ' },
    zh: { code: 'zh', copy: '复制', copied: '已复制', expandScope: '展开范围', collapseScope: '折叠范围' },
    ru: { code: 'ru', copy: 'Копировать', copied: 'Скопировано', expandScope: 'Развернуть область', collapseScope: 'Свернуть область' },
    pt: { code: 'pt', copy: 'Copiar', copied: 'Copiado', expandScope: 'Expandir escopo', collapseScope: 'Recolher escopo' },
};

/** An object is used as it is; an id is looked up; anything else follows the page's `lang`, then English. */
export function resolveCodeBlockLocale(input: string | CodeBlockLocale | null | undefined): CodeBlockLocale {
    if (input && typeof input === 'object') return input;
    const page = typeof document === 'undefined' ? '' : (document.documentElement.lang.split('-')[0] ?? '').toLowerCase();
    return (input ? CODE_BLOCK_LOCALES[input] : undefined) ?? CODE_BLOCK_LOCALES[page] ?? CODE_BLOCK_LOCALES.en;
}
