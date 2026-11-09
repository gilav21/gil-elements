import base from './data-table.css?inline';
import columnsCss from './data-table-columns.css?inline';
import rowsCss from './data-table-rows.css?inline';
import windowCss from './data-table-window.css?inline';

/**
 * The one stylesheet: data-table.css is a single `@layer`, and each package's region file holds bare rules that join it
 * just before its closing brace, so the adopted sheet keeps one rule and packages never edit the same file.
 */
const layer = base.trimEnd();
// Empty where styles are not loaded (the node test project, server rendering); anything else must be a closed @layer.
if (layer !== '' && !layer.endsWith('}')) throw new Error('data-table.css must end with the closing brace of its @layer: the package region files are spliced in before it');
export const css: string = layer === '' ? '' : `${layer.slice(0, -1)}${rowsCss}\n${windowCss}\n${columnsCss}\n}`;
