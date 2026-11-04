/**
 * The strings of `COMMON_LOCALES` in shadcn-angular that the combobox family uses, so a `locale` means the same
 * in both libraries. Add keys here as more components need them.
 */
export interface CommonLocale {
    code: string;
    rtl?: boolean;
    selectPlaceholder: string;
    noResults: string;
    oneTimeCode: string;
}

export const COMMON_LOCALES: Record<string, CommonLocale | undefined> & { en: CommonLocale } = {
    en: { code: 'en', selectPlaceholder: 'Select...', noResults: 'No results found.', oneTimeCode: 'One-time code' },
    he: { code: 'he', rtl: true, selectPlaceholder: '...בחר', noResults: 'לא נמצאו תוצאות.', oneTimeCode: 'קוד חד-פעמי' },
    ar: { code: 'ar', rtl: true, selectPlaceholder: '...اختر', noResults: 'لم يتم العثور على نتائج.', oneTimeCode: 'رمز لمرة واحدة' },
    de: { code: 'de', selectPlaceholder: 'Auswählen...', noResults: 'Keine Ergebnisse gefunden.', oneTimeCode: 'Einmalcode' },
    fr: { code: 'fr', selectPlaceholder: 'Sélectionner...', noResults: 'Aucun résultat trouvé.', oneTimeCode: 'Code à usage unique' },
    es: { code: 'es', selectPlaceholder: 'Seleccionar...', noResults: 'No se encontraron resultados.', oneTimeCode: 'Código de un solo uso' },
    ja: { code: 'ja', selectPlaceholder: '選択...', noResults: '結果が見つかりません。', oneTimeCode: 'ワンタイムコード' },
    zh: { code: 'zh', selectPlaceholder: '选择...', noResults: '未找到结果。', oneTimeCode: '一次性验证码' },
    ru: { code: 'ru', selectPlaceholder: 'Выбрать...', noResults: 'Результаты не найдены.', oneTimeCode: 'Одноразовый код' },
    pt: { code: 'pt', selectPlaceholder: 'Selecionar...', noResults: 'Nenhum resultado encontrado.', oneTimeCode: 'Código de uso único' },
};

/** An object is used as it is; an id is looked up; anything else follows the page's `lang`, then English. */
export function resolveCommonLocale(input: string | CommonLocale | null | undefined): CommonLocale {
    if (input && typeof input === 'object') return input;
    const page = typeof document === 'undefined' ? '' : (document.documentElement.lang.split('-')[0] ?? '').toLowerCase();
    return (input ? COMMON_LOCALES[input] : undefined) ?? COMMON_LOCALES[page] ?? COMMON_LOCALES.en;
}
