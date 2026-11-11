// Cases that put the selection column over the rows of the other wave 4 modes (flat, tree, grouped), against shadcn-angular's
// own markup: the checkbox of its `_selection` cell and header (data-table.component.html 105-115, 542-548, the `ui-checkbox` of
// checkbox.component.html), a selected row's `data-state="selected"`, and the indeterminate states of the header and of a tree parent.
// Laid over the same table shell as data-table.mjs and data-table-rows.mjs, whose helpers are reused.
import { cellStyle, elTable, ROWS, rewrite } from './data-table.mjs';
import { agg, BTN, COLS, dataRows, GROUP_ROWS, groupRow, icon, shade, shell, sub, TREE, treeCell, visible } from './data-table-rows.mjs';

// shadcn-angular checkbox.component.html / .ts classes(), as in cases/checkbox.mjs.
const BOX = 'shrink-0 rounded-sm border border-primary shadow outline-none peer-focus-visible:ring-1 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50 flex items-center justify-center';
const CHECK = '<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>';
const DASH = '<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14" /></svg>';
const INPUT = 'peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed';
const checkbox = (state, label) =>
    `<ui-checkbox class="contents"><div class="contents"><span class="relative inline-flex shrink-0"><input type="checkbox" class="${INPUT}" aria-label="${label}"${state === 'on' ? ' checked' : ''}><span class="${BOX} ${state === 'off' ? 'bg-background' : 'bg-primary text-primary-foreground'}" data-slot="checkbox" aria-hidden="true">${state === 'mixed' ? DASH : state === 'on' ? CHECK : ''}</span></span></div></ui-checkbox>`;

const SEL = { accessorKey: '_selection', header: '', width: '40px' };

/** The selection column is pinned to the start (sticky), as Angular makes it. */
const pinned = (c, header) => {
    const base = cellStyle(c.width);
    if (c.accessorKey === '_selection') return `${base} position: sticky; left: 0px; z-index: ${header ? 30 : 10};${header ? ' top: 0px;' : ''}`;
    return header ? `${base} position: sticky; top: 0px; z-index: 20;` : base;
};

/**
 * `html` (a reference table with a `_selection` column) with Angular's checkbox in the header and in every body row, and
 * `data-state="selected"` on the selected rows. `states` is one of 'on' | 'mixed' | 'off' per body row, in order.
 */
function withSelection(html, header, states) {
    let out = rewrite(html, /(data-column-id="_selection"[^>]*>)[\s\S]*?(<\/ui-table-head>)/, (_, a, b) => `${a}<div class="flex items-center w-full h-full"><div class="flex-1 min-w-0">${checkbox(header, 'Select all')}</div></div>${b}`, 'selection head');
    // The pinned selection cell is opaque (it hides what scrolls under it) and takes the row's selected colour: Angular paints it
    // `bg-background` over the tint, a gap in the row; the agreed fix, as in data-table.mjs, is the one the element draws.
    let cell = 0;
    out = rewrite(out, /<ui-table-cell class="([^"]*)"([^>]*data-column="_selection"[^>]*>)[^<]*<\/ui-table-cell>/g, (match, cls, rest) => {
        const state = states[cell++];
        return `<ui-table-cell class="${state === 'on' ? cls.replace('bg-background', 'bg-muted') : cls}"${rest}${checkbox(state, 'Select row')}</ui-table-cell>`;
    }, 'selection cells', states.length);
    let row = 0;
    return rewrite(out, /(<ui-table-row class="[^"]*" data-slot="table-row" role="row" data-row-index="\d+")/g, (match) => (states[row++] === 'on' ? `${match} data-state="selected"` : match), 'selected rows', states.length);
}

// ---- a flat table: the header is mixed while some rows are selected ----------------------------------------------------

const FLAT = ROWS.slice(0, 4);
const flatRef = (ids) => {
    const states = FLAT.map((r) => (ids.includes(r.id) ? 'on' : 'off'));
    const header = ids.length === 0 ? 'off' : ids.length === FLAT.length ? 'on' : 'mixed';
    return withSelection(shell([SEL, ...COLS], dataRows([SEL, ...COLS], FLAT, 0, 2, pinned).join(''), pinned), header, states);
};
const flatEl = (ids) => elTable({ columns: COLS, rows: FLAT, attrs: 'show-footer="false" enable-row-selection', props: { rowSelection: Object.fromEntries(ids.map((id) => [id, true])) } });

// ---- a tree, expanded, with a selected child: its parent is mixed ------------------------------------------------------

function treeRef(open, selected) {
    const rows = visible(TREE, open);
    const own = (r) => selected.includes(r.id);
    // a node is mixed when some but not all of its descendants are selected (cascade `descendants`)
    const below = (r) => (r.children ?? []).flatMap((c) => [c, ...below(c)]);
    const stateOf = (r) => {
        const kids = below(r);
        if (kids.length === 0) return own(r) ? 'on' : 'off';
        const n = kids.filter(own).length;
        return n === kids.length ? 'on' : n > 0 ? 'mixed' : 'off';
    };
    const body = rows.map(({ row, depth }, i) => {
        const [html] = dataRows([SEL, ...COLS], [{ ...row, children: undefined }], i, i + 2, pinned);
        const named = rewrite(html, /(data-column="name"[^>]*>)[^<]*(<\/ui-table-cell>)/, (_, a, b) => `${a}${treeCell(row, depth, open.includes(row.id))}${b}`, 'tree name cell');
        // the sticky selection cell keeps its own opaque colour: only the other cells take the depth shade
        return rewrite(named, /(data-column="(?!_selection)[^"]*" style=")width:/g, `$1${shade(depth)} width:`, 'tree depth shade', 'some');
    });
    const states = rows.map(({ row }) => stateOf(row));
    const allButton = `<button type="button" class="${BTN}" aria-label="Collapse all sub-rows">${icon('chevrons-up', '')}</button>`;
    const header = states.every((s) => s === 'on') ? 'on' : states.some((s) => s !== 'off') ? 'mixed' : 'off';
    const table = rewrite(shell([SEL, ...COLS], body.join(''), pinned), /(data-column-id="name"[\s\S]*?<div class="flex items-center gap-2">)/, (_, a) => `${a}${allButton}`, 'tree expand-all button');
    return withSelection(table, header, states);
}
const treeEl = (open, selected) =>
    elTable({
        columns: COLS,
        rows: TREE,
        attrs: 'show-footer="false" enable-sub-rows enable-row-selection sub-row-selection-mode="descendants"',
        props: { subRowExpandedRows: Object.fromEntries(open.map((id) => [id, true])), rowSelection: Object.fromEntries(selected.map((id) => [id, true])) },
    });

// ---- groups with aggregates over selectable rows ------------------------------------------------------------------------

function groupedRef(selected) {
    const parts = [];
    const states = [];
    let index = 0;
    let aria = 2;
    for (const role of ['Engineer', 'Designer']) {
        const rows = sub(role);
        parts.push(groupRow(role, role, rows.length, { meta: agg(rows) }));
        aria++;
        parts.push(...dataRows([SEL, ...COLS], rows, index, aria, pinned));
        states.push(...rows.map((r) => (selected.includes(r.id) ? 'on' : 'off')));
        index += rows.length;
        aria += rows.length;
    }
    const header = states.every((s) => s === 'on') ? 'on' : states.some((s) => s === 'on') ? 'mixed' : 'off';
    return withSelection(shell([SEL, ...COLS], parts.join(''), pinned), header, states);
}
const groupedEl = (selected) =>
    elTable({ columns: COLS, rows: GROUP_ROWS, attrs: 'show-footer="false" enable-row-selection', props: { groupBy: 'role', rowSelection: Object.fromEntries(selected.map((id) => [id, true])) } });

export const items = [
    { id: 'selection-none', wrap: 'width:100%;', ref: flatRef([]), el: flatEl([]) },
    { id: 'selection-mixed-header', wrap: 'width:100%;', ref: flatRef(['U-1', 'U-3']), el: flatEl(['U-1', 'U-3']) },
    { id: 'selection-all', wrap: 'width:100%;', ref: flatRef(FLAT.map((r) => r.id)), el: flatEl(FLAT.map((r) => r.id)) },
    // Dark only: two pixels at the clipped bottom-left corner, where the opaque pinned selection cell meets the rounded border.
    { id: 'tree-selected-child', maxDiffPx: 4, wrap: 'width:100%;', ref: treeRef(['T-1', 'T-1b', 'T-2'], ['T-1b', 'T-1b1']), el: treeEl(['T-1', 'T-1b', 'T-2'], ['T-1b', 'T-1b1']) },
    { id: 'tree-selected-subtree', maxDiffPx: 4, wrap: 'width:100%;', ref: treeRef(['T-1', 'T-1b', 'T-2'], ['T-1', 'T-1a', 'T-1b', 'T-1b1']), el: treeEl(['T-1', 'T-1b', 'T-2'], ['T-1', 'T-1a', 'T-1b', 'T-1b1']) },
    // On Linux one glyph (the A of the second group's aggregate) is antialiased at another sub-pixel offset, as in data-table-rows.mjs.
    { id: 'group-aggregates-selected', maxDiffPx: 40, wrap: 'width:100%;', ref: groupedRef(['U-1', 'U-4']), el: groupedEl(['U-1', 'U-4']) },
];

export default { name: 'data-table-integration', isolated: true, width: 700, items };
