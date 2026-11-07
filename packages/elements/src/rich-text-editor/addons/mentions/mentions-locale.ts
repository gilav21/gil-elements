import type { RichTextAddonLocaleTable } from '../../rich-text-addon-kit.js';

export interface MentionsLocale {
    readonly code: string;
    readonly rtl?: boolean;
    readonly noUsersFound: string;
    readonly noTagsFound: string;
    readonly selectUser: string;
    readonly selectTag: string;
}

export const mentionsLocales: RichTextAddonLocaleTable<MentionsLocale> = {
    en: { code: 'en', noUsersFound: 'No users found', noTagsFound: 'No tags found', selectUser: 'Select a user', selectTag: 'Select a tag' },
    he: { code: 'he', rtl: true, noUsersFound: 'לא נמצאו משתמשים', noTagsFound: 'לא נמצאו תגיות', selectUser: 'בחירת משתמש', selectTag: 'בחירת תגית' },
    ar: { code: 'ar', rtl: true, noUsersFound: 'لم يتم العثور على مستخدمين', noTagsFound: 'لم يتم العثور على وسوم', selectUser: 'اختيار مستخدم', selectTag: 'اختيار وسم' },
    de: { code: 'de', noUsersFound: 'Keine Benutzer gefunden', noTagsFound: 'Keine Tags gefunden', selectUser: 'Benutzer auswählen', selectTag: 'Tag auswählen' },
    fr: { code: 'fr', noUsersFound: 'Aucun utilisateur trouvé', noTagsFound: 'Aucun tag trouvé', selectUser: 'Sélectionner un utilisateur', selectTag: 'Sélectionner un tag' },
    es: { code: 'es', noUsersFound: 'No se encontraron usuarios', noTagsFound: 'No se encontraron etiquetas', selectUser: 'Seleccionar un usuario', selectTag: 'Seleccionar una etiqueta' },
    ja: { code: 'ja', noUsersFound: 'ユーザーが見つかりません', noTagsFound: 'タグが見つかりません', selectUser: 'ユーザーを選択', selectTag: 'タグを選択' },
    zh: { code: 'zh', noUsersFound: '未找到用户', noTagsFound: '未找到标签', selectUser: '选择用户', selectTag: '选择标签' },
    ru: { code: 'ru', noUsersFound: 'Пользователи не найдены', noTagsFound: 'Теги не найдены', selectUser: 'Выбрать пользователя', selectTag: 'Выбрать тег' },
    pt: { code: 'pt', noUsersFound: 'Nenhum usuário encontrado', noTagsFound: 'Nenhuma tag encontrada', selectUser: 'Selecionar um usuário', selectTag: 'Selecionar uma tag' },
};
