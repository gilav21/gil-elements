/** Wording for the country picker's search field and its empty result, in the languages the Angular library ships. */
export interface PhoneInputLocale {
    code: string;
    rtl?: boolean;
    searchCountryPlaceholder: string;
    noCountryFound: string;
}

export const PHONE_INPUT_LOCALES: Record<string, PhoneInputLocale | undefined> & { en: PhoneInputLocale } = {
    en: { code: 'en', searchCountryPlaceholder: 'Search country...', noCountryFound: 'No countries found' },
    he: { code: 'he', rtl: true, searchCountryPlaceholder: '...חיפוש מדינה', noCountryFound: 'לא נמצאו מדינות' },
    ar: { code: 'ar', rtl: true, searchCountryPlaceholder: '...بحث عن دولة', noCountryFound: 'لم يتم العثور على دول' },
    de: { code: 'de', searchCountryPlaceholder: 'Land suchen...', noCountryFound: 'Keine Länder gefunden' },
    fr: { code: 'fr', searchCountryPlaceholder: 'Rechercher un pays...', noCountryFound: 'Aucun pays trouvé' },
    es: { code: 'es', searchCountryPlaceholder: 'Buscar país...', noCountryFound: 'No se encontraron países' },
    ja: { code: 'ja', searchCountryPlaceholder: '国を検索...', noCountryFound: '国が見つかりません' },
    zh: { code: 'zh', searchCountryPlaceholder: '搜索国家...', noCountryFound: '未找到国家' },
    ru: { code: 'ru', searchCountryPlaceholder: 'Поиск страны...', noCountryFound: 'Страны не найдены' },
    pt: { code: 'pt', searchCountryPlaceholder: 'Buscar país...', noCountryFound: 'Nenhum país encontrado' },
};

/** An object is used as it is; an id is looked up; anything else follows the page's `lang`, then English. */
export function resolvePhoneInputLocale(input: string | PhoneInputLocale | null | undefined): PhoneInputLocale {
    if (input && typeof input === 'object') return input;
    const page = typeof document === 'undefined' ? '' : (document.documentElement.lang.split('-')[0] ?? '').toLowerCase();
    return (input ? PHONE_INPUT_LOCALES[input] : undefined) ?? PHONE_INPUT_LOCALES[page] ?? PHONE_INPUT_LOCALES.en;
}
