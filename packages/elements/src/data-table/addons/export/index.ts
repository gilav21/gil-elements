/**
 * `@gilav21/elements/data-table/addons/export`: CSV and XLSX export for `ge-data-table`. Enable it with `table.use(exportAddon)` (or import
 * `.../export/define` and list `export` in the `addons` attribute), then call `table.addon<ExportApi>('export')?.exportToCsv()`.
 * The xlsx writer is exported too, to build a workbook without a table.
 */
export {
    exportAddon,
    exportFilename,
    typedCell,
    CSV_MIME,
    XLSX_MIME,
    type ExportApi,
    type ExportCompleteDetail,
    type ExportDataProvider,
    type ExportErrorDetail,
    type ExportFormat,
    type ExportOptions,
    type ExportRequest,
} from './export.js';
export { EXPORT_LOCALES, type ExportLocale } from './export-locale.js';
export { generateXlsx, sanitizeSheetName, XLSX_MAX_CELL_LENGTH, XLSX_MAX_COLUMNS, XLSX_MAX_ROWS, type XlsxCell, type XlsxOptions } from '../../../shared/xlsx.js';
