import base from './data-table.css?inline';
import columnsCss from './data-table-columns.css?inline';
import dragCss from './data-table-drag.css?inline';
import editCss from './data-table-edit.css?inline';
import filtersCss from './data-table-filters.css?inline';
import rangeCss from './data-table-range.css?inline';
import rowsCss from './data-table-rows.css?inline';
import windowCss from './data-table-window.css?inline';

/**
 * The one stylesheet: data-table.css is a single `@layer`, and each package's region file holds bare rules that join it
 * just before its closing brace, so the adopted sheet keeps one rule and packages never edit the same file.
 * Wave 4: rows, window, columns. Wave 5: filters (package A), edit (package B). Wave 6: range (A), drag and flash (C).
 */
const layer = base.trimEnd();
// Empty where styles are not loaded (the node test project, server rendering); anything else must be a closed @layer.
if (layer !== '' && !layer.endsWith('}')) throw new Error('data-table.css must end with the closing brace of its @layer: the package region files are spliced in before it');
const regions = [rowsCss, windowCss, columnsCss, filtersCss, editCss, rangeCss, dragCss];
export const css: string = layer === '' ? '' : `${layer.slice(0, -1)}${regions.join('\n')}\n}`;
