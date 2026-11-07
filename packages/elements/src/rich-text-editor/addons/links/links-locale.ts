import type { RichTextAddonLocaleTable } from '../../rich-text-addon-kit.js';

/** Strings of the links addon: the toolbar button, the insert/edit form and the `/link` slash command. */
export interface RichTextLinksLocale {
    readonly code: string;
    readonly rtl?: boolean;
    /** Toolbar button tooltip and form heading. */
    readonly tooltip: string;
    readonly text: string;
    readonly textPlaceholder: string;
    readonly url: string;
    readonly urlPlaceholder: string;
    readonly insert: string;
    readonly update: string;
    readonly remove: string;
    readonly cancel: string;
    /** Shown under the URL field when the address is not one the editor accepts. */
    readonly invalidUrl: string;
    readonly commandLabel: string;
    readonly commandDescription: string;
}

export const RICH_TEXT_LINKS_LOCALES: RichTextAddonLocaleTable<RichTextLinksLocale> = {
    en: { code: 'en', tooltip: 'Insert Link', text: 'Link Text', textPlaceholder: 'Display text', url: 'URL', urlPlaceholder: 'https://example.com', insert: 'Insert Link', update: 'Update', remove: 'Remove', cancel: 'Cancel', invalidUrl: 'Enter a valid web address (http:// or https://)', commandLabel: 'Link', commandDescription: 'Insert or edit a link' },
    he: { code: 'he', rtl: true, tooltip: 'הוספת קישור', text: 'טקסט הקישור', textPlaceholder: 'טקסט לתצוגה', url: 'כתובת URL', urlPlaceholder: 'https://example.com', insert: 'הוספת קישור', update: 'עדכון', remove: 'הסרה', cancel: 'ביטול', invalidUrl: 'יש להזין כתובת אינטרנט תקינה (http:// או https://)', commandLabel: 'קישור', commandDescription: 'הוספה או עריכה של קישור' },
    ar: { code: 'ar', rtl: true, tooltip: 'إدراج رابط', text: 'نص الرابط', textPlaceholder: 'نص العرض', url: 'عنوان URL', urlPlaceholder: 'https://example.com', insert: 'إدراج رابط', update: 'تحديث', remove: 'إزالة', cancel: 'إلغاء', invalidUrl: 'أدخل عنوان ويب صالحًا (http:// أو https://)', commandLabel: 'رابط', commandDescription: 'إدراج أو تعديل رابط' },
    de: { code: 'de', tooltip: 'Link einfügen', text: 'Linktext', textPlaceholder: 'Anzeigetext', url: 'URL', urlPlaceholder: 'https://example.com', insert: 'Link einfügen', update: 'Aktualisieren', remove: 'Entfernen', cancel: 'Abbrechen', invalidUrl: 'Gültige Webadresse eingeben (http:// oder https://)', commandLabel: 'Link', commandDescription: 'Link einfügen oder bearbeiten' },
    fr: { code: 'fr', tooltip: 'Insérer un lien', text: 'Texte du lien', textPlaceholder: 'Texte affiché', url: 'URL', urlPlaceholder: 'https://example.com', insert: 'Insérer le lien', update: 'Mettre à jour', remove: 'Supprimer', cancel: 'Annuler', invalidUrl: 'Saisissez une adresse web valide (http:// ou https://)', commandLabel: 'Lien', commandDescription: 'Insérer ou modifier un lien' },
    es: { code: 'es', tooltip: 'Insertar enlace', text: 'Texto del enlace', textPlaceholder: 'Texto mostrado', url: 'URL', urlPlaceholder: 'https://example.com', insert: 'Insertar enlace', update: 'Actualizar', remove: 'Eliminar', cancel: 'Cancelar', invalidUrl: 'Introduce una dirección web válida (http:// o https://)', commandLabel: 'Enlace', commandDescription: 'Insertar o editar un enlace' },
    ja: { code: 'ja', tooltip: 'リンクを挿入', text: 'リンクテキスト', textPlaceholder: '表示テキスト', url: 'URL', urlPlaceholder: 'https://example.com', insert: 'リンクを挿入', update: '更新', remove: '削除', cancel: 'キャンセル', invalidUrl: '有効なウェブアドレスを入力してください (http:// または https://)', commandLabel: 'リンク', commandDescription: 'リンクを挿入または編集' },
    zh: { code: 'zh', tooltip: '插入链接', text: '链接文字', textPlaceholder: '显示文字', url: 'URL', urlPlaceholder: 'https://example.com', insert: '插入链接', update: '更新', remove: '移除', cancel: '取消', invalidUrl: '请输入有效的网址 (http:// 或 https://)', commandLabel: '链接', commandDescription: '插入或编辑链接' },
    ru: { code: 'ru', tooltip: 'Вставить ссылку', text: 'Текст ссылки', textPlaceholder: 'Отображаемый текст', url: 'URL', urlPlaceholder: 'https://example.com', insert: 'Вставить ссылку', update: 'Обновить', remove: 'Удалить', cancel: 'Отмена', invalidUrl: 'Введите корректный веб-адрес (http:// или https://)', commandLabel: 'Ссылка', commandDescription: 'Вставить или изменить ссылку' },
    pt: { code: 'pt', tooltip: 'Inserir link', text: 'Texto do link', textPlaceholder: 'Texto exibido', url: 'URL', urlPlaceholder: 'https://example.com', insert: 'Inserir link', update: 'Atualizar', remove: 'Remover', cancel: 'Cancelar', invalidUrl: 'Insira um endereço web válido (http:// ou https://)', commandLabel: 'Link', commandDescription: 'Inserir ou editar um link' },
};
