/** The strings of `BAR_RACE_CHART_LOCALES` in shadcn-angular, so a `locale` means the same in both libraries. */
export interface BarRaceChartLocale {
    code: string;
    rtl?: boolean;
    play: string;
    pause: string;
    reset: string;
    timeline: string;
}

export const BAR_RACE_CHART_LOCALES: Record<string, BarRaceChartLocale | undefined> & { en: BarRaceChartLocale } = {
    en: { code: 'en', play: 'Play', pause: 'Pause', reset: 'Reset', timeline: 'Timeline frame' },
    he: { code: 'he', rtl: true, play: 'הפעל', pause: 'השהה', reset: 'איפוס', timeline: 'מסגרת ציר זמן' },
    ar: { code: 'ar', rtl: true, play: 'تشغيل', pause: 'إيقاف مؤقت', reset: 'إعادة تعيين', timeline: 'إطار الجدول الزمني' },
    de: { code: 'de', play: 'Abspielen', pause: 'Pause', reset: 'Zurücksetzen', timeline: 'Zeitachsen-Frame' },
    fr: { code: 'fr', play: 'Lecture', pause: 'Pause', reset: 'Réinitialiser', timeline: 'Image de la chronologie' },
    es: { code: 'es', play: 'Reproducir', pause: 'Pausar', reset: 'Restablecer', timeline: 'Fotograma de la línea de tiempo' },
    ja: { code: 'ja', play: '再生', pause: '一時停止', reset: 'リセット', timeline: 'タイムラインフレーム' },
    zh: { code: 'zh', play: '播放', pause: '暂停', reset: '重置', timeline: '时间轴帧' },
    ru: { code: 'ru', play: 'Воспроизвести', pause: 'Пауза', reset: 'Сбросить', timeline: 'Кадр временной шкалы' },
    pt: { code: 'pt', play: 'Reproduzir', pause: 'Pausar', reset: 'Redefinir', timeline: 'Quadro da linha do tempo' },
};

/** An object is used as it is; an id is looked up; anything else follows the page's `lang`, then English. */
export function resolveBarRaceLocale(input: string | BarRaceChartLocale | null | undefined): BarRaceChartLocale {
    if (input && typeof input === 'object') return input;
    const page = typeof document === 'undefined' ? '' : (document.documentElement.lang.split('-')[0] ?? '').toLowerCase();
    return (input ? BAR_RACE_CHART_LOCALES[input] : undefined) ?? BAR_RACE_CHART_LOCALES[page] ?? BAR_RACE_CHART_LOCALES.en;
}
