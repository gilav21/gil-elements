// A cell range with the range readout of shadcn-angular's data-table (cmp 3232: `bg-primary/15` on a cell in the range; html 1488-1515: the
// readout), laid over the shell of data-table.mjs. The element side sets `cellRange` through `data-props` (the range part loads lazily and draws it).
// Not static, so not here (verified by the browser tests instead): the fill handle (its position is measured after layout), the fill preview band,
// the drop indicator, a flash, the clipboard.
import { ref as button } from '../lib/button-ref.mjs';
import { elTable, refTable, rewrite } from './data-table.mjs';

const COLS = [
    { accessorKey: 'name', header: 'Name', width: '160px' },
    { accessorKey: 'q1', header: 'Q1', width: '100px' },
    { accessorKey: 'q2', header: 'Q2', width: '100px' },
    { accessorKey: 'q3', header: 'Q3', width: '100px' },
];
const ROWS = [
    { id: 'S-1', name: 'North', q1: 10, q2: 20, q3: 5 },
    { id: 'S-2', name: 'South', q1: 4, q2: 6, q3: 8 },
    { id: 'S-3', name: 'East', q1: 7, q2: 1, q3: 3 },
    { id: 'S-4', name: 'West', q1: 2, q2: 9, q3: 4 },
];
// rows 0..2 of Q1 and Q2: a 3x2 range of numbers
const RANGE = { startRow: 0, startCol: 'q1', endRow: 2, endCol: 'q2' };
const IN = ['q1', 'q2'];
const values = ROWS.slice(0, 3).flatMap((r) => IN.map((k) => r[k]));
const sum = values.reduce((a, b) => a + b, 0);
const STATS = [
    ['Count', values.length],
    ['Sum', sum],
    ['Avg', Math.round((sum / values.length) * 100) / 100],
    ['Min', Math.min(...values)],
    ['Max', Math.max(...values)],
];

const chartIcon =
    '<ui-icon name="bar-chart-3" size="xs" class="me-1"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ui-icon ui-icon-bar-chart-3" data-slot="icon"><path d="M3 3v18h18" /><path d="M8 17V9" /><path d="M13 17V5" /><path d="M18 17v-6" /></svg></ui-icon>';
const readout = `<div data-slot="range-actions" class="sticky bottom-0 z-20 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-x-4 gap-y-1 border-t bg-background/95 px-3 py-1.5 text-xs backdrop-blur-sm">${STATS.map(
    ([label, value]) => `<span class="text-muted-foreground">${label}: <span class="text-foreground font-medium">${value}</span></span>`,
).join('')}${button('outline', 'sm', `${chartIcon}Chart`, { extra: 'ms-auto h-6 px-2 pointer-coarse:h-11', host: 'aria-label="Chart"' })}</div>`;

/** The reference table with the range tint on the cells of `RANGE` and the readout after the table, inside the scroll container. */
function ref() {
    let html = refTable({ columns: COLS, rows: ROWS });
    for (let row = RANGE.startRow; row <= RANGE.endRow; row++) {
        html = rewrite(
            html,
            new RegExp(`(<ui-table-row class="[^"]*" data-slot="table-row" role="row" data-row-index="${row}"[\\s\\S]*?</ui-table-row>)`),
            (rowHtml) => rewrite(rowHtml, new RegExp(`(<ui-table-cell class="[^"]*)(" data-slot="table-cell" role="gridcell" aria-colindex="\\d+" data-column="(?:${IN.join('|')})")`, 'g'), '$1 bg-primary/15$2', `range row ${row}`, IN.length),
            `range row ${row}`,
        );
    }
    return rewrite(html, /(<\/ui-table>)(<\/div><\/div>)$/, `$1${readout}$2`, 'readout after the table');
}

const el = () => elTable({ columns: COLS, rows: ROWS, attrs: 'show-footer="false" enable-cell-range-selection enable-range-actions', props: { cellRange: RANGE } });

export const items = [
    // The readout's labels are separate text nodes on our side ("Avg" and ": "): a few glyphs land on another sub-pixel offset, about 100 pixels of
    // antialiasing in the label row and nothing else.
    { id: 'range-readout', maxDiffPx: 150, wrap: 'width:100%;', ref: ref(), el: el() },
    // No rtl case: a PLAIN rtl table (no range) already differs from this reference by a 2 px shift of every column (the reference's fixed widths in an
    // rtl scroll container), which a readout case would only repeat. The range and the readout in rtl are pinned by the browser tests (handle corner, keys).
];

export default { name: 'data-table-spreadsheet', isolated: true, width: 700, items };
