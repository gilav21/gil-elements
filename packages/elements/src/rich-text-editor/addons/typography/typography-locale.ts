import type { RichTextAddonLocaleTable } from '../../rich-text-addon-kit.js';

/** Strings of the typography addon. */
export interface RichTextTypographyLocale {
    readonly code: string;
    readonly rtl?: boolean;
    /** Font-size button tooltip. */
    readonly fontSize: string;
    /** Font-family button tooltip. */
    readonly fontFamily: string;
    /** Font-size panel heading. */
    readonly selectSize: string;
    /** Font-size field placeholder. */
    readonly selectSizePlaceholder: string;
    /** Font-family panel heading. */
    readonly selectFamily: string;
    /** Font-family field placeholder. */
    readonly selectFamilyPlaceholder: string;
}

export const RICH_TEXT_TYPOGRAPHY_LOCALES: RichTextAddonLocaleTable<RichTextTypographyLocale> = {
    en: { code: 'en', fontSize: 'Font Size', fontFamily: 'Font Family', selectSize: 'Select Size', selectSizePlaceholder: 'Select size', selectFamily: 'Select Font', selectFamilyPlaceholder: 'Search fonts...' },
    he: { code: 'he', rtl: true, fontSize: 'גודל גופן', fontFamily: 'משפחת גופנים', selectSize: 'בחירת גודל', selectSizePlaceholder: 'בחירת גודל', selectFamily: 'בחירת גופן', selectFamilyPlaceholder: 'חיפוש גופנים...' },
    ar: { code: 'ar', rtl: true, fontSize: 'حجم الخط', fontFamily: 'نوع الخط', selectSize: 'اختيار الحجم', selectSizePlaceholder: 'اختيار الحجم', selectFamily: 'اختيار الخط', selectFamilyPlaceholder: 'البحث عن خطوط...' },
    de: { code: 'de', fontSize: 'Schriftgröße', fontFamily: 'Schriftart', selectSize: 'Größe wählen', selectSizePlaceholder: 'Größe wählen', selectFamily: 'Schriftart wählen', selectFamilyPlaceholder: 'Schriftarten suchen...' },
    fr: { code: 'fr', fontSize: 'Taille de police', fontFamily: 'Police de caractères', selectSize: 'Choisir la taille', selectSizePlaceholder: 'Choisir la taille', selectFamily: 'Choisir la police', selectFamilyPlaceholder: 'Rechercher des polices...' },
    es: { code: 'es', fontSize: 'Tamaño de fuente', fontFamily: 'Familia tipográfica', selectSize: 'Seleccionar tamaño', selectSizePlaceholder: 'Seleccionar tamaño', selectFamily: 'Seleccionar fuente', selectFamilyPlaceholder: 'Buscar fuentes...' },
    ja: { code: 'ja', fontSize: 'フォントサイズ', fontFamily: 'フォント', selectSize: 'サイズを選択', selectSizePlaceholder: 'サイズを選択', selectFamily: 'フォントを選択', selectFamilyPlaceholder: 'フォントを検索...' },
    zh: { code: 'zh', fontSize: '字号', fontFamily: '字体', selectSize: '选择大小', selectSizePlaceholder: '选择大小', selectFamily: '选择字体', selectFamilyPlaceholder: '搜索字体...' },
    ru: { code: 'ru', fontSize: 'Размер шрифта', fontFamily: 'Шрифт', selectSize: 'Выбрать размер', selectSizePlaceholder: 'Выберите размер', selectFamily: 'Выбрать шрифт', selectFamilyPlaceholder: 'Поиск шрифтов...' },
    pt: { code: 'pt', fontSize: 'Tamanho da fonte', fontFamily: 'Família tipográfica', selectSize: 'Selecionar tamanho', selectSizePlaceholder: 'Selecionar tamanho', selectFamily: 'Selecionar fonte', selectFamilyPlaceholder: 'Pesquisar fontes...' },
};
