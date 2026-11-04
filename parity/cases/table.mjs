// shadcn-angular table.component.ts and sub/*.component.ts (+ the density part of the cell and head css).
const HEAD = 'text-foreground ltr:text-left rtl:text-right font-medium flex-1 [&:has([role=checkbox])]:ltr:pr-0 [&:has([role=checkbox])]:rtl:pl-0 [&>[role=checkbox]]:translate-y-[2px]';
const CELL = 'flex-1 [&:has([role=checkbox])]:ltr:pr-0 [&:has([role=checkbox])]:rtl:pl-0 [&>[role=checkbox]]:translate-y-[2px]';
// tailwind-merge: a class that sets the width/alignment replaces nothing, but `flex-none` replaces the built-in flex-1.
const col = (base, extra) => (extra.includes('flex-none') ? base.replace('flex-1 ', '').replace('flex-1', '') : base);

const rHead = (text, extra = '', role = 'columnheader') =>
    `<ui-table-head class="flex items-center flex-shrink-0 ${col(HEAD, extra)} ${extra}" data-slot="table-head" role="${role}">${text}</ui-table-head>`;
const rCell = (text, extra = '', role = 'cell') =>
    `<ui-table-cell class="flex items-center flex-shrink-0 ${col(CELL, extra)} ${extra}" data-slot="table-cell" role="${role}">${text}</ui-table-cell>`;
const rRow = (inner, selected = false) =>
    `<ui-table-row class="flex w-full min-w-max flex-shrink-0 hover:bg-muted/50 data-[state=selected]:bg-muted transition-colors" data-slot="table-row"${selected ? ' data-state="selected"' : ''} role="row">${inner}</ui-table-row>`;
const rHeader = (inner) => `<ui-table-header class="sticky top-0 z-20 bg-background flex-shrink-0" data-slot="table-header" role="rowgroup">${inner}</ui-table-header>`;
const rBody = (inner) => `<ui-table-body class="flex flex-col flex-1" data-slot="table-body" role="rowgroup">${inner}</ui-table-body>`;
const rFooter = (inner) => `<ui-table-footer class="flex flex-col flex-shrink-0 bg-muted/50 border-t font-medium" data-slot="table-footer" role="rowgroup">${inner}</ui-table-footer>`;
const rCaption = (text) => `<ui-table-caption class="flex text-muted-foreground mt-4 text-sm" data-slot="table-caption">${text}</ui-table-caption>`;
const rTable = (inner, role = 'table', extra = '') => `<ui-table class="contents"><div class="flex flex-col w-full min-h-0 overflow-x-auto ${extra}" data-slot="table" role="${role}">${inner}</div></ui-table>`;

const eHead = (text, style = '', attrs = '') => `<ge-table-head${style ? ` style="${style}"` : ''}${attrs}>${text}</ge-table-head>`;
const eCell = (text, style = '') => `<ge-table-cell${style ? ` style="${style}"` : ''}>${text}</ge-table-cell>`;
const eRow = (inner, selected = false) => `<ge-table-row${selected ? ' selected' : ''}>${inner}</ge-table-row>`;

const NARROW = { ref: 'w-[100px] flex-none', el: 'flex:none;width:100px' };
const RIGHT = { ref: 'text-right w-[100px] flex-none', el: 'flex:none;width:100px;text-align:right' };
const ROWS = [['INV001', 'Paid', 'Credit Card', '$250.00'], ['INV002', 'Pending', 'PayPal', '$150.00'], ['INV003', 'Unpaid', 'Bank Transfer', '$350.00']];

const build = ({ selected = -1, footer = false, caption = true, skeleton = false, role = 'table', size } = {}) => {
    const cellRole = role === 'table' ? 'cell' : 'gridcell';
    const head = rRow(rHead('Invoice', NARROW.ref) + rHead('Status') + rHead('Method') + rHead('Amount', RIGHT.ref));
    const eHeadRow = eRow(eHead('Invoice', NARROW.el) + eHead('Status') + eHead('Method') + eHead('Amount', RIGHT.el));
    const body = ROWS.map((r, i) => rRow(rCell(r[0], `font-medium ${NARROW.ref}`, cellRole) + rCell(r[1], '', cellRole) + rCell(r[2], '', cellRole) + rCell(r[3], RIGHT.ref, cellRole), selected === i)).join('');
    const eBodyRows = ROWS.map((r, i) => eRow(eCell(r[0], `font-weight:500;${NARROW.el}`) + eCell(r[1]) + eCell(r[2]) + eCell(r[3], RIGHT.el), selected === i)).join('');
    const skel = Array.from({ length: 3 }, () => rRow(rCell('<ui-skeleton class="rounded-md animate-pulse bg-primary/10 h-4 w-full"></ui-skeleton>', '', cellRole))).join('');
    const foot = rRow(rCell('Total', `font-medium ${NARROW.ref}`, cellRole) + rCell('') + rCell('') + rCell('$750.00', RIGHT.ref, cellRole));
    const eFootRow = eRow(eCell('Total', `font-weight:500;${NARROW.el}`) + eCell('') + eCell('') + eCell('$750.00', RIGHT.el));
    return {
        ref: rTable((caption ? rCaption('A list of your recent invoices.') : '') + rHeader(head) + rBody(skeleton ? skel : body) + (footer ? rFooter(foot) : ''), role),
        el: `<ge-table${role === 'table' ? '' : ` role="${role}"`}>${caption ? '<ge-table-caption>A list of your recent invoices.</ge-table-caption>' : ''}<ge-table-header>${eHeadRow}</ge-table-header><ge-table-body${skeleton ? ' skeleton skeleton-rows="3"' : ''}>${skeleton ? '' : eBodyRows}</ge-table-body>${footer ? `<ge-table-footer>${eFootRow}</ge-table-footer>` : ''}</ge-table>`,
    };
};

const W = 'width:560px;';
const make = (id, opts, wrap = W, wrapRtl = false) => {
    const b = build(opts);
    return { id, wrap, ref: wrapRtl ? `<div dir="rtl">${b.ref}</div>` : b.ref, el: wrapRtl ? `<div dir="rtl">${b.el}</div>` : b.el };
};
const items = [
    make('basic'),
    make('selected-row', { selected: 1 }),
    make('footer', { footer: true }),
    make('no-caption', { caption: false }),
    make('skeleton', { skeleton: true }),
    make('density-1.5', {}, `${W}--density:1.5;`),
    make('grid', { role: 'grid' }),
    make('rtl', {}, W, true),
    make('overflow', {}, 'width:300px;'),
];
export default { name: 'table', items };
