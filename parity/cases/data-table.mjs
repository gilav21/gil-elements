// shadcn-angular data-table.component.html as it renders (class strings from the template and from cmp 3099-3305, the
// table primitives from table.mjs). The element side is `ge-data-table` with its toolbar and pager off.
import { ref as button } from '../lib/button-ref.mjs';

const HEAD = 'text-foreground ltr:text-left rtl:text-right font-medium flex-1 [&:has([role=checkbox])]:ltr:pr-0 [&:has([role=checkbox])]:rtl:pl-0 [&>[role=checkbox]]:translate-y-[2px]';
const CELL = 'flex-1 [&:has([role=checkbox])]:ltr:pr-0 [&:has([role=checkbox])]:rtl:pl-0 [&>[role=checkbox]]:translate-y-[2px]';
const GLYPH = {
    'chevrons-up-down': '<path d="m7 9 5-5 5 5" /><path d="m7 15 5 5 5-5" />',
    'arrow-up': '<path d="M12 20V4" /><path d="m6 10 6-6 6 6" />',
    'arrow-down': '<path d="M12 4v16" /><path d="m6 14 6 6 6-6" />',
};
const icon = (name, cls) =>
    `<ui-icon class="${cls}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ui-icon ui-icon-${name}" data-slot="icon">${GLYPH[name]}</svg></ui-icon>`;

export const COLUMNS = [
    { accessorKey: 'id', header: 'ID', width: '80px' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'role', header: 'Role' },
    { accessorKey: 'age', header: 'Age', width: '100px' },
];
export const ROWS = [
    { id: 'U-1', name: 'Alice Martin', role: 'Engineer', age: 34 },
    { id: 'U-2', name: 'Bob Stone', role: 'Designer', age: 28 },
    { id: 'U-3', name: 'Carol Diaz', role: 'Manager', age: 41 },
    { id: 'U-4', name: 'Dave Lee', role: 'Analyst', age: 25 },
];

/** The inline style `_buildCellStyle` produces for a fixed or auto column. */
export const cellStyle = (width, { min = '80px', pin = '' } = {}) => {
    const auto = !width || width === 'auto';
    return `width: ${auto ? '0px' : width}; min-width: ${auto ? min : width}; max-width: ${auto ? 'none' : width}; flex-shrink: ${auto ? 1 : 0}; flex-grow: ${auto ? 1 : 0}; flex-basis: ${auto ? '0px' : 'auto'};${pin}`;
};

const headerCell = (c, i, { sort, borders, style }) => {
    const dir = sort?.find((s) => s.column === c.accessorKey);
    const index = sort && sort.length > 1 ? sort.findIndex((s) => s.column === c.accessorKey) : -1;
    const arrow = dir?.direction === 'asc' ? 'arrow-up' : dir?.direction === 'desc' ? 'arrow-down' : 'chevrons-up-down';
    const badge = index >= 0 ? `<span class="ms-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] leading-none" aria-hidden="true">${index + 1}</span>` : '';
    const label = `<span class="truncate">${c.header}</span>${icon(arrow, 'ms-2 h-4 w-4')}${badge}`;
    // tailwind-merge (cn) drops the button's base shrink-0 for the later shrink, which the shared button reference does not do.
    const sortButton = `<ui-data-table-column-header class="min-w-0"><div class="flex items-center gap-x-2" data-slot="data-table-column-header">${button('ghost', 'sm', label, { extra: '-ms-2 h-8 pointer-coarse:h-11 min-w-0 pointer-coarse:min-w-11 shrink data-[state=open]:bg-accent' }).replace(' shrink-0 ', ' ')}</div></ui-data-table-column-header>`;
    return `<ui-table-head class="flex items-center flex-shrink-0 ${HEAD} sticky top-0 bg-background shadow-sm whitespace-nowrap overflow-hidden text-ellipsis pointer-coarse:h-auto z-20 ${borders ? 'border-r' : ''} group/head" data-slot="table-head" role="columnheader" aria-colindex="${i + 1}" aria-sort="${dir?.direction === 'asc' ? 'ascending' : dir?.direction === 'desc' ? 'descending' : 'none'}" data-column-id="${c.accessorKey}" style="${style(c, true)}"><div class="flex items-center w-full h-full"><div class="flex-1 min-w-0"><div class="flex items-center gap-2">${sortButton}</div></div></div></ui-table-head>`;
};

const bodyCell = (c, i, row, { rowBorders, colBorders, style, cellHtml }) =>
    `<ui-table-cell class="flex items-center flex-shrink-0 ${CELL} whitespace-nowrap overflow-hidden text-ellipsis bg-background ${rowBorders ? 'border-b' : ''} ${colBorders ? 'border-r' : ''}" data-slot="table-cell" role="gridcell" aria-colindex="${i + 1}" data-column="${c.accessorKey}" style="${style(c, false)}">${cellHtml?.(c, row) ?? row[c.accessorKey]}</ui-table-cell>`;

const footerCell = (c, text, style) =>
    `<ui-table-cell class="flex items-center flex-shrink-0 ${CELL} whitespace-nowrap overflow-hidden text-ellipsis text-sm font-medium text-muted-foreground" data-slot="table-cell" role="gridcell" style="${style(c, false)}">${text ?? ''}</ui-table-cell>`;

const ROW_CLASS = 'flex w-full min-w-max flex-shrink-0 hover:bg-muted/50 data-[state=selected]:bg-muted transition-colors';

/** The Angular tree for a read-only table: viewport, ui-table, header, body, optional footer. */
export function refTable({ columns = COLUMNS, rows = ROWS, sort, rowBorders = true, colBorders = true, footer, style = (c) => cellStyle(c.width), empty = false, loader = false, cellHtml, scrollLeft } = {}) {
    const ctx = { sort, borders: colBorders, rowBorders, colBorders, style, cellHtml };
    const flexible = columns.some((c) => !c.width);
    const head = `<ui-table-row class="${ROW_CLASS}" data-slot="table-row" role="row" aria-rowindex="1">${columns.map((c, i) => headerCell(c, i, ctx)).join('')}${flexible ? '' : `<ui-table-head role="presentation" class="flex items-center flex-shrink-0 ${HEAD} flex-1 pointer-events-none sticky top-0 bg-background shadow-sm whitespace-nowrap overflow-hidden text-ellipsis pointer-coarse:h-auto z-20 ${colBorders ? 'border-r' : ''}" data-slot="table-head"></ui-table-head>`}</ui-table-row>`;
    const body = empty
        ? `<ui-table-row class="${ROW_CLASS} hover:bg-transparent justify-center w-full" data-slot="table-row" role="row"><ui-table-cell class="flex items-center flex-shrink-0 ${CELL} h-48 sm:h-96 text-center w-full p-0 border-none justify-center" data-slot="table-cell" role="gridcell"><div class="flex h-full flex-col items-center justify-center py-10 text-center text-muted-foreground w-full"><ui-icon class="mb-4 opacity-20"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ui-icon ui-icon-circle-off" data-slot="icon"><circle cx="12" cy="12" r="9" /><path d="m4 4 16 16" /></svg></ui-icon><p>No results found.</p></div></ui-table-cell></ui-table-row>`
        : rows
              .map((r, ri) => `<ui-table-row class="${ROW_CLASS} border-0" data-slot="table-row" role="row" data-row-index="${ri}" aria-rowindex="${ri + 2}">${columns.map((c, i) => bodyCell(c, i, r, ctx)).join('')}${flexible ? '' : `<ui-table-cell class="flex items-center flex-shrink-0 ${CELL} flex-1 pointer-events-none whitespace-nowrap overflow-hidden text-ellipsis bg-background ${rowBorders ? 'border-b' : ''} ${colBorders ? 'border-r' : ''}" data-slot="table-cell"></ui-table-cell>`}</ui-table-row>`)
              .join('');
    const spacer = `<ui-table-row class="${ROW_CLASS} h-full" data-slot="table-row" aria-hidden="true">${columns.map((c) => `<ui-table-cell class="flex items-center flex-shrink-0 ${CELL} whitespace-nowrap overflow-hidden text-ellipsis bg-background border-0 p-0" data-slot="table-cell" style="${style(c, false)}"></ui-table-cell>`).join('')}</ui-table-row>`;
    const foot = footer
        ? `<div class="sticky bottom-0 z-20 bg-background border-t" data-slot="table-footer"><ui-table-row class="${ROW_CLASS}" data-slot="table-row" role="row">${columns.map((c) => footerCell(c, footer[c.accessorKey], style)).join('')}${flexible ? '' : `<ui-table-cell class="flex items-center flex-shrink-0 ${CELL} flex-1 pointer-events-none" data-slot="table-cell"></ui-table-cell>`}</ui-table-row></div>`
        : '';
    const overlay = loader
        ? '<div class="absolute inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-[1px]"><div class="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground"><span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"></span><span>Loading...</span></div></div>'
        : '';
    return `<div class="relative flex flex-col w-full h-full space-y-4"><output class="sr-only" aria-live="polite" aria-atomic="true" data-slot="data-table-announcer"></output><div class="rounded-md border relative flex-1 min-h-0 overflow-auto w-full" tabindex="0"${scrollLeft === undefined ? '' : ` data-scroll-left="${scrollLeft}"`}>${overlay}<ui-table class="overflow-visible"><div class="flex flex-col w-full min-h-0 overflow-visible" data-slot="table" role="grid"><ui-table-header class="sticky top-0 z-20 bg-background flex-shrink-0 bg-background" data-slot="table-header" role="rowgroup">${head}</ui-table-header><ui-table-body class="flex flex-col flex-1" data-slot="table-body" role="rowgroup">${body}${spacer}</ui-table-body>${foot}</div></ui-table></div></div>`;
}

const esc = (value) => JSON.stringify(value).replaceAll('&', '&amp;').replaceAll("'", '&#39;');
export function elTable({ columns = COLUMNS, rows = ROWS, attrs = '', props = {}, sort } = {}) {
    const state = sort ? { multiSortState: sort, sortState: sort[0], enableMultiSort: sort.length > 1 } : {};
    return `<ge-data-table show-toolbar="false" show-pagination="false" ${attrs} data-props='${esc({ columns, data: rows, ...state, ...props })}'></ge-data-table>`;
}

const W = 'width:100%;';
export const items = [
    { id: 'basic', wrap: W, ref: refTable(), el: elTable() },
    { id: 'row-borders-only', wrap: W, ref: refTable({ colBorders: false }), el: elTable({ attrs: 'show-column-borders="false"' }) },
    { id: 'column-borders-only', wrap: W, ref: refTable({ rowBorders: false }), el: elTable({ attrs: 'show-row-borders="false"' }) },
    { id: 'no-borders', wrap: W, ref: refTable({ rowBorders: false, colBorders: false }), el: elTable({ attrs: 'show-row-borders="false" show-column-borders="false"' }) },
    { id: 'density-1.5', wrap: `${W}--density:1.5;`, ref: refTable(), el: elTable() },
    { id: 'sorted-asc', wrap: W, ref: refTable({ sort: [{ column: 'name', direction: 'asc' }], rows: [...ROWS].sort((a, b) => a.name.localeCompare(b.name)) }), el: elTable({ sort: [{ column: 'name', direction: 'asc' }] }) },
    { id: 'sorted-desc', wrap: W, ref: refTable({ sort: [{ column: 'age', direction: 'desc' }], rows: [...ROWS].sort((a, b) => b.age - a.age) }), el: elTable({ sort: [{ column: 'age', direction: 'desc' }] }) },
    {
        id: 'multi-sort-badges',
        wrap: W,
        ref: refTable({ sort: [{ column: 'role', direction: 'asc' }, { column: 'age', direction: 'desc' }], rows: [...ROWS].sort((a, b) => a.role.localeCompare(b.role) || b.age - a.age) }),
        el: elTable({ sort: [{ column: 'role', direction: 'asc' }, { column: 'age', direction: 'desc' }], props: { data: ROWS } }),
    },
    {
        id: 'footer-aggregates',
        wrap: W,
        ref: refTable({ footer: { id: 'Total', age: '128' } }),
        el: elTable({ columns: COLUMNS.map((c) => (c.accessorKey === 'id' ? { ...c, footer: 'Total' } : c.accessorKey === 'age' ? { ...c, aggregateFn: 'sum' } : c)) }),
    },
    { id: 'empty', wrap: W, ref: refTable({ empty: true }), el: elTable({ props: { data: [] } }) },
    { id: 'loading-overlay', wrap: W, ref: refTable({ loader: true }), el: elTable({ attrs: 'loading' }) },
    {
        id: 'all-fixed-widths',
        wrap: W,
        ref: refTable({ columns: COLUMNS.map((c) => ({ ...c, width: c.width ?? '160px' })) }),
        el: elTable({ columns: COLUMNS.map((c) => ({ ...c, width: c.width ?? '160px' })) }),
    },
];

export default { name: 'data-table', isolated: true, width: 700, items };
