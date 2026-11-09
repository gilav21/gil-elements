import base from './data-table.css?inline';
import columnsCss from './data-table-columns.css?inline';
import rowsCss from './data-table-rows.css?inline';
import windowCss from './data-table-window.css?inline';

/**
 * The one stylesheet: data-table.css is a single `@layer`, and each package's region file holds bare rules that join it
 * just before its closing brace, so the adopted sheet keeps one rule and packages never edit the same file.
 */
export const css: string = base.replace(/\}\s*$/, () => `${rowsCss}\n${windowCss}\n${columnsCss}\n}`);
