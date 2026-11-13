/** The export addon's strings (rule 6.1: `en` ships here; other languages are added to `EXPORT_LOCALES` by the wave 8 locale modules). */
export interface ExportLocale {
    /** Busy-overlay label while an export runs. */
    exporting: string;
    /** Announced when a file was handed to the browser. */
    exportDone: string;
    /** Announced when an export failed (a provider rejected, the writer threw). */
    exportFailed: string;
    /** Announced instead of downloading an empty file (no header and no row). */
    exportEmpty: string;
}

const en: ExportLocale = {
    exporting: 'Exporting…',
    exportDone: 'Export complete',
    exportFailed: 'Export failed',
    exportEmpty: 'Nothing to export',
};

/** By locale code (lowercase, e.g. `'pt-br'`); `en` is the fallback. Mutable on purpose: a locale module adds its language here. */
export const EXPORT_LOCALES: Record<string, ExportLocale | undefined> & { en: ExportLocale } = { en };
