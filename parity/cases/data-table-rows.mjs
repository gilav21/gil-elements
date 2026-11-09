// Group header rows, detail rows and tree rows of shadcn-angular's data-table (html 1127-1341, cellTpl 79-165), laid over the
// same table shell as data-table.mjs: its own rows are reused, only the markup Angular adds for these three modes is written here.
import { cellStyle, elTable, refTable } from './data-table.mjs';

const ROW_CLASS = 'flex w-full min-w-max flex-shrink-0 hover:bg-muted/50 data-[state=selected]:bg-muted transition-colors';
const CELL = 'flex items-center flex-shrink-0 flex-1 [&:has([role=checkbox])]:ltr:pr-0 [&:has([role=checkbox])]:rtl:pl-0 [&>[role=checkbox]]:translate-y-[2px] whitespace-nowrap overflow-hidden text-ellipsis';
const WIDE = 'min-width: 0; max-width: none; width: 100%; flex-basis: 100%;';
const BTN = 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground pointer-coarse:size-11';
const GLYPH = {
    'chevron-right': '<path d="m9 5 7 7-7 7" />',
    'chevron-down': '<path d="m5 9 7 7 7-7" />',
    'chevron-up': '<path d="m5 15 7-7 7 7" />',
    'chevrons-down': '<path d="m6 5 6 6 6-6" /><path d="m6 13 6 6 6-6" />',
    'chevrons-up': '<path d="m6 11 6-6 6 6" /><path d="m6 19 6-6 6 6" />',
};
const icon = (name, cls) =>
    `<ui-icon name="${name}" size="xs" class="${cls}"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ui-icon ui-icon-${name}" data-slot="icon">${GLYPH[name]}</svg></ui-icon>`;

const COLS = [{ accessorKey: 'name', header: 'Name' }, { accessorKey: 'role', header: 'Role', width: '140px' }, { accessorKey: 'age', header: 'Age', width: '100px', aggregateFn: 'sum' }];

/** The data rows of refTable, re-numbered; `ria` is the aria-rowindex of the first. */
function dataRows(columns, rows, start, ria, style) {
    const html = refTable({ columns, rows, ...(style ? { style } : {}) });
    const found = html.match(/<ui-table-row class="[^"]*border-0"[^>]*data-row-index="\d+"[\s\S]*?<\/ui-table-row>/g) ?? [];
    return found.map((r, i) => r.replace(/data-row-index="\d+" aria-rowindex="\d+"/, `data-row-index="${start + i}" aria-rowindex="${ria + i}"`));
}

/** refTable's shell with `rowsHtml` as the body rows, before the stretching spacer row. */
function shell(columns, rowsHtml, style) {
    const base = refTable({ columns, rows: [], ...(style ? { style } : {}) });
    const at = base.indexOf(`<ui-table-row class="${ROW_CLASS} h-full"`);
    return base.slice(0, at) + rowsHtml + base.slice(at);
}

// ---- group headers --------------------------------------------------------------------------------------------------

const groupRow = (key, label, count, { collapsed = false, meta = '' } = {}) =>
    `<ui-table-row class="${ROW_CLASS} border-0 bg-muted/40 cursor-pointer select-none" data-slot="table-group-row" data-group-key="${key}" aria-expanded="${!collapsed}"><ui-table-cell class="${CELL} border-b font-medium" data-slot="table-cell" style="${WIDE}"><div class="flex flex-wrap items-center gap-2"><button type="button" class="${BTN}" aria-label="${collapsed ? 'Expand group' : 'Collapse group'}">${icon('chevron-right', `transition-transform duration-200${collapsed ? '' : ' rotate-90'}`)}</button><span class="truncate">${label}</span><span class="text-xs text-muted-foreground">(${count})</span>${meta}</div></ui-table-cell></ui-table-row>`;

const GROUP_ROWS = [
    { id: 'U-1', name: 'Alice Martin', role: 'Engineer', age: 34 },
    { id: 'U-2', name: 'Bob Stone', role: 'Designer', age: 28 },
    { id: 'U-3', name: 'Carol Diaz', role: 'Engineer', age: 41 },
    { id: 'U-4', name: 'Dave Lee', role: 'Designer', age: 25 },
];
const sub = (role) => GROUP_ROWS.filter((r) => r.role === role);
const agg = (rows) => `<span class="text-xs text-muted-foreground">Age: ${rows.reduce((n, r) => n + r.age, 0)}</span>`;

const grouped = (collapsedKey) => {
    const parts = [];
    let index = 0;
    let aria = 2;
    for (const role of ['Engineer', 'Designer']) {
        const rows = sub(role);
        const collapsed = role === collapsedKey;
        parts.push(groupRow(role, role, rows.length, { collapsed, meta: agg(rows) }));
        aria++;
        if (collapsed) continue;
        parts.push(...dataRows(COLS, rows, index, aria));
        index += rows.length;
        aria += rows.length;
    }
    return shell(COLS, parts.join(''));
};
const groupEl = (collapsed) => elTable({ columns: COLS, rows: GROUP_ROWS, attrs: 'show-footer="false"', props: { groupBy: 'role', ...(collapsed ? { collapsedGroups: { [collapsed]: true } } : {}) } });

// ---- detail rows ----------------------------------------------------------------------------------------------------

const X = { accessorKey: '_expander', header: '', width: '40px' };
const expanderButton = (name) =>
    `<button type="button" class="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground pointer-coarse:size-11" aria-label="Expand row">${icon(name, '')}</button>`;

/** Angular's expander column: a button in the header and in every cell, in place of the sort header and the value. */
function withExpander(html, open) {
    const head = /(data-column-id="_expander"[^>]*>)[\s\S]*?(<\/ui-table-head>)/;
    let out = html.replace(head, `$1<div class="flex items-center w-full h-full"><div class="flex-1 min-w-0">${expanderButton('chevrons-down')}</div></div>$2`);
    let i = 0;
    out = out.replace(/(data-column="_expander"[^>]*>)[^<]*(<\/ui-table-cell>)/g, (_, a, b) => `${a}${expanderButton(open.includes(i++) ? 'chevron-up' : 'chevron-down')}${b}`);
    return out;
}

const detailRow = (row) =>
    `<ui-table-row class="${ROW_CLASS} border-0 bg-muted/20" data-slot="table-row"><ui-table-cell class="${CELL} border-b" data-slot="table-cell" style="${WIDE}"><pre class="text-xs text-muted-foreground whitespace-pre-wrap">${JSON.stringify(row, null, 2)}</pre></ui-table-cell></ui-table-row>`;

/** The expander column is pinned to the start (sticky), as Angular makes it. */
const pinned = (c, header) => {
    const base = cellStyle(c.width);
    if (c.accessorKey === '_expander') return `${base} position: sticky; left: 0px; z-index: ${header ? 30 : 10};${header ? ' top: 0px;' : ''}`;
    return header ? `${base} position: sticky; top: 0px; z-index: 20;` : base;
};

const DETAIL_ROWS = GROUP_ROWS.slice(0, 3);
function detailRef(open) {
    const parts = [];
    let aria = 2;
    for (const [i, row] of DETAIL_ROWS.entries()) {
        parts.push(...dataRows([X, ...COLS], [row], i, aria++, pinned));
        if (open.includes(i)) parts.push(detailRow(row));
    }
    return withExpander(shell([X, ...COLS], parts.join(''), pinned), open);
}
const detailEl = (open) => elTable({ columns: COLS, rows: DETAIL_ROWS, attrs: 'show-footer="false" enable-row-expansion', props: { expandedRows: Object.fromEntries(open.map((i) => [DETAIL_ROWS[i].id, true])) } });

// ---- tree rows ------------------------------------------------------------------------------------------------------

const TREE = [
    { id: 'T-1', name: 'Platform', role: 'Team', age: 3, children: [{ id: 'T-1a', name: 'Alice Martin', role: 'Engineer', age: 34 }, { id: 'T-1b', name: 'Carol Diaz', role: 'Engineer', age: 41, children: [{ id: 'T-1b1', name: 'Dave Lee', role: 'Intern', age: 25 }] }] },
    { id: 'T-2', name: 'Design', role: 'Team', age: 1, children: [{ id: 'T-2a', name: 'Bob Stone', role: 'Designer', age: 28 }] },
];
const shade = (depth) => `background-color: ${depth > 0 ? `color-mix(in srgb, var(--border) ${Math.min(depth * 20, 80)}%, var(--background))` : 'var(--background)'};`;

/** The visible rows with their depth, the children of a collapsed node left out. */
const visible = (rows, open, depth = 0) => rows.flatMap((r) => [{ row: r, depth }, ...(r.children && open.includes(r.id) ? visible(r.children, open, depth + 1) : [])]);

const treeCell = (r, depth, open) =>
    `<div class="flex items-center gap-1 min-w-0" style="padding-inline-start: ${depth * 20}px">${r.children ? `<button type="button" class="${BTN}" aria-label="${open ? 'Collapse sub-rows' : 'Expand sub-rows'}">${icon('chevron-right', `transition-transform duration-200${open ? ' rotate-90' : ''}`)}</button>` : '<span class="inline-block h-6 w-6 shrink-0"></span>'}<span class="truncate">${r.name}</span></div>`;

function treeRef(open) {
    const all = TREE.every((r) => !r.children || open.includes(r.id)) && TREE.flatMap((r) => r.children ?? []).every((r) => !r.children || open.includes(r.id));
    const rows = visible(TREE, open).map(({ row, depth }, i) => {
        const [html] = dataRows(COLS, [{ ...row, children: undefined }], i, i + 2);
        return html
            .replace(/(data-column="name"[^>]*>)[^<]*(<\/ui-table-cell>)/, (_, a, b) => `${a}${treeCell(row, depth, open.includes(row.id))}${b}`)
            .replaceAll('style="width:', `style="${shade(depth)} width:`);
    });
    const allButton = `<button type="button" class="${BTN}" aria-label="${all ? 'Collapse all sub-rows' : 'Expand all sub-rows'}">${icon(all ? 'chevrons-up' : 'chevrons-down', '')}</button>`;
    return shell(COLS, rows.join('')).replace(/(data-column-id="name"[\s\S]*?<div class="flex items-center gap-2">)/, (_, a) => `${a}${allButton}`);
}
const treeEl = (open) => elTable({ columns: COLS, rows: TREE, attrs: 'show-footer="false" enable-sub-rows', props: { subRowExpandedRows: Object.fromEntries(open.map((id) => [id, true])) } });

export const items = [
    // On Linux one glyph (the A of the second group's aggregate) is antialiased at another sub-pixel offset: 16-18 pixels, nothing else differs.
    { id: 'group-headers', maxDiffPx: 40, wrap: 'width:100%;', ref: grouped(null), el: groupEl(null) },
    { id: 'group-collapsed', maxDiffPx: 40, wrap: 'width:100%;', ref: grouped('Engineer'), el: groupEl('Engineer') },
    { id: 'detail-closed', wrap: 'width:100%;', ref: detailRef([]), el: detailEl([]) },
    { id: 'detail-open', wrap: 'width:100%;', ref: detailRef([1]), el: detailEl([1]) },
    { id: 'tree-collapsed', wrap: 'width:100%;', ref: treeRef([]), el: treeEl([]) },
    { id: 'tree-expanded', wrap: 'width:100%;', ref: treeRef(['T-1', 'T-1b', 'T-2']), el: treeEl(['T-1', 'T-1b', 'T-2']) },
];

export default { name: 'data-table-rows', isolated: true, width: 700, items };
