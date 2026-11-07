import type { RichTextAddonLocaleTable } from '../../rich-text-addon-kit.js';

/** Strings of the emoji addon. */
export interface RichTextEmojiLocale {
    readonly code: string;
    readonly rtl?: boolean;
    /** Tooltip for the emoji toolbar button. */
    readonly insertEmoji: string;
}

export const RICH_TEXT_EMOJI_LOCALES: RichTextAddonLocaleTable<RichTextEmojiLocale> = {
    en: { code: 'en', insertEmoji: 'Insert Emoji' },
    he: { code: 'he', rtl: true, insertEmoji: "הוספת אמוג'י" },
    ar: { code: 'ar', rtl: true, insertEmoji: 'إدراج رمز تعبيري' },
    de: { code: 'de', insertEmoji: 'Emoji einfügen' },
    fr: { code: 'fr', insertEmoji: 'Insérer un emoji' },
    es: { code: 'es', insertEmoji: 'Insertar emoji' },
    ja: { code: 'ja', insertEmoji: '絵文字を挿入' },
    zh: { code: 'zh', insertEmoji: '插入表情' },
    ru: { code: 'ru', insertEmoji: 'Вставить эмодзи' },
    pt: { code: 'pt', insertEmoji: 'Inserir emoji' },
};
