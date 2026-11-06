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
    previousSlide: string;
    nextSlide: string;
    close: string;
    copied: string;
    tourPrevious: string;
    tourNext: string;
    tourFinish: string;
    tourSkip: string;
    tourLoading: string;
    comparisonSlider: string;
}

export const COMMON_LOCALES: Record<string, CommonLocale | undefined> & { en: CommonLocale } = {
    en: { code: 'en', selectPlaceholder: 'Select...', noResults: 'No results found.', oneTimeCode: 'One-time code', previousSlide: 'Previous slide', nextSlide: 'Next slide', close: 'Close', copied: 'Copied!', tourPrevious: 'Previous', tourNext: 'Next', tourFinish: 'Done', tourSkip: 'Skip', tourLoading: 'Loading...', comparisonSlider: 'Comparison slider' },
    he: { code: 'he', rtl: true, selectPlaceholder: '...בחר', noResults: 'לא נמצאו תוצאות.', oneTimeCode: 'קוד חד-פעמי', previousSlide: 'השקופית הקודמת', nextSlide: 'השקופית הבאה', close: 'סגור', copied: '!הועתק', tourPrevious: 'הקודם', tourNext: 'הבא', tourFinish: 'סיום', tourSkip: 'דלג', tourLoading: '...טוען', comparisonSlider: 'מחוון השוואה' },
    ar: { code: 'ar', rtl: true, selectPlaceholder: '...اختر', noResults: 'لم يتم العثور على نتائج.', oneTimeCode: 'رمز لمرة واحدة', previousSlide: 'الشريحة السابقة', nextSlide: 'الشريحة التالية', close: 'إغلاق', copied: '!تم النسخ', tourPrevious: 'السابق', tourNext: 'التالي', tourFinish: 'إنهاء', tourSkip: 'تخطي', tourLoading: '...جاري التحميل', comparisonSlider: 'شريط المقارنة' },
    de: { code: 'de', selectPlaceholder: 'Auswählen...', noResults: 'Keine Ergebnisse gefunden.', oneTimeCode: 'Einmalcode', previousSlide: 'Vorherige Folie', nextSlide: 'Nächste Folie', close: 'Schließen', copied: 'Kopiert!', tourPrevious: 'Zurück', tourNext: 'Weiter', tourFinish: 'Fertig', tourSkip: 'Überspringen', tourLoading: 'Wird geladen...', comparisonSlider: 'Vergleichsregler' },
    fr: { code: 'fr', selectPlaceholder: 'Sélectionner...', noResults: 'Aucun résultat trouvé.', oneTimeCode: 'Code à usage unique', previousSlide: 'Diapositive précédente', nextSlide: 'Diapositive suivante', close: 'Fermer', copied: 'Copié !', tourPrevious: 'Précédent', tourNext: 'Suivant', tourFinish: 'Terminé', tourSkip: 'Passer', tourLoading: 'Chargement...', comparisonSlider: 'Curseur de comparaison' },
    es: { code: 'es', selectPlaceholder: 'Seleccionar...', noResults: 'No se encontraron resultados.', oneTimeCode: 'Código de un solo uso', previousSlide: 'Diapositiva anterior', nextSlide: 'Diapositiva siguiente', close: 'Cerrar', copied: '¡Copiado!', tourPrevious: 'Anterior', tourNext: 'Siguiente', tourFinish: 'Listo', tourSkip: 'Omitir', tourLoading: 'Cargando...', comparisonSlider: 'Control deslizante de comparación' },
    ja: { code: 'ja', selectPlaceholder: '選択...', noResults: '結果が見つかりません。', oneTimeCode: 'ワンタイムコード', previousSlide: '前のスライド', nextSlide: '次のスライド', close: '閉じる', copied: 'コピーしました！', tourPrevious: '前へ', tourNext: '次へ', tourFinish: '完了', tourSkip: 'スキップ', tourLoading: '読み込み中...', comparisonSlider: '比較スライダー' },
    zh: { code: 'zh', selectPlaceholder: '选择...', noResults: '未找到结果。', oneTimeCode: '一次性验证码', previousSlide: '上一张幻灯片', nextSlide: '下一张幻灯片', close: '关闭', copied: '已复制！', tourPrevious: '上一页', tourNext: '下一页', tourFinish: '完成', tourSkip: '跳过', tourLoading: '加载中...', comparisonSlider: '对比滑块' },
    ru: { code: 'ru', selectPlaceholder: 'Выбрать...', noResults: 'Результаты не найдены.', oneTimeCode: 'Одноразовый код', previousSlide: 'Предыдущий слайд', nextSlide: 'Следующий слайд', close: 'Закрыть', copied: 'Скопировано!', tourPrevious: 'Назад', tourNext: 'Далее', tourFinish: 'Готово', tourSkip: 'Пропустить', tourLoading: 'Загрузка...', comparisonSlider: 'Ползунок сравнения' },
    pt: { code: 'pt', selectPlaceholder: 'Selecionar...', noResults: 'Nenhum resultado encontrado.', oneTimeCode: 'Código de uso único', previousSlide: 'Slide anterior', nextSlide: 'Próximo slide', close: 'Fechar', copied: 'Copiado!', tourPrevious: 'Anterior', tourNext: 'Próximo', tourFinish: 'Concluído', tourSkip: 'Pular', tourLoading: 'Carregando...', comparisonSlider: 'Controle deslizante de comparação' },
};

/** An object is used as it is; an id is looked up; anything else follows the page's `lang`, then English. */
export function resolveCommonLocale(input: string | CommonLocale | null | undefined): CommonLocale {
    if (input && typeof input === 'object') return input;
    const page = typeof document === 'undefined' ? '' : (document.documentElement.lang.split('-')[0] ?? '').toLowerCase();
    return (input ? COMMON_LOCALES[input] : undefined) ?? COMMON_LOCALES[page] ?? COMMON_LOCALES.en;
}
