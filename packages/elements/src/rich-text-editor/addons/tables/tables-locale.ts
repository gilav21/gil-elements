import type { RichTextAddonLocaleTable } from '../../rich-text-addon-kit.js';

/** Strings of the tables addon. */
export interface RichTextTablesLocale {
    readonly code: string;
    readonly rtl?: boolean;
    /** Toolbar button tooltip. */
    readonly tooltip: string;
    /** Grid-picker hint shown before a size is hovered; also the slash command's label. */
    readonly insertTable: string;
}

export const RICH_TEXT_TABLES_LOCALES: RichTextAddonLocaleTable<RichTextTablesLocale> = {
    en: { code: 'en', tooltip: 'Insert Table', insertTable: 'Insert Table' },
    he: { code: 'he', rtl: true, tooltip: 'הוספת טבלה', insertTable: 'הוספת טבלה' },
    ar: { code: 'ar', rtl: true, tooltip: 'إدراج جدول', insertTable: 'إدراج جدول' },
    de: { code: 'de', tooltip: 'Tabelle einfügen', insertTable: 'Tabelle einfügen' },
    fr: { code: 'fr', tooltip: 'Insérer un tableau', insertTable: 'Insérer un tableau' },
    es: { code: 'es', tooltip: 'Insertar tabla', insertTable: 'Insertar tabla' },
    ja: { code: 'ja', tooltip: 'テーブルを挿入', insertTable: 'テーブルを挿入' },
    zh: { code: 'zh', tooltip: '插入表格', insertTable: '插入表格' },
    ru: { code: 'ru', tooltip: 'Вставить таблицу', insertTable: 'Вставить таблицу' },
    pt: { code: 'pt', tooltip: 'Inserir tabela', insertTable: 'Inserir tabela' },
};
