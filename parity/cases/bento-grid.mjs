// shadcn-angular bento-grid.component: a `grid w-full relative grid-cols-12 min-h-full` of `.bento-item` cards (bg-card, border when editable or bordered,
// `shadow` when bordered, rounded and padded by inline style) over a dot pattern while editable. The grips, options button and merge bar are invisible at
// rest (opacity-0 until hover), so the references carry them as empty boxes. The harness pads each case by 12px a side.
const LAYOUT = [
    { id: 'a', x: 1, y: 1, cols: 2, rows: 2, content: 'Revenue' },
    { id: 'b', x: 3, y: 1, cols: 2, rows: 1, content: 'Orders' },
    { id: 'c', x: 3, y: 2, cols: 1, rows: 1, content: 'Users' },
    { id: 'd', x: 4, y: 2, cols: 1, rows: 1, content: 'Churn' },
];
const GAP = 16;
const ROW = 60;
const cardRef = (item, { editable, bordered, radius = '0.75rem', padding = '1rem' }) => {
    const cls = ['bento-item', 'relative', 'group', 'bg-card', 'text-card-foreground', 'transition-all', 'duration-200', 'overflow-hidden', 'min-h-0',
        editable || bordered ? 'border' : '', bordered ? 'shadow' : '', editable ? 'cursor-grab hover:shadow-lg' : ''].filter(Boolean).join(' ');
    const style = `border-radius:${radius};padding:${padding};grid-column-start:${item.x};grid-column-end:span ${item.cols};grid-row-start:${item.y};grid-row-end:span ${item.rows}`;
    const tools = editable
        ? '<div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><button class="p-1 hover:bg-muted rounded" aria-label="Item options"></button></div>'
          + '<div class="absolute top-0 inset-x-2 h-2 z-10"></div><div class="absolute bottom-0 inset-x-2 h-2 z-10"></div><div class="absolute left-0 inset-y-2 w-2 z-10"></div><div class="absolute right-0 inset-y-2 w-2 z-10"></div>'
        : '';
    return `<div class="${cls}" data-item-id="${item.id}" style="${style}" ${editable ? 'draggable="true"' : 'draggable="false"'} tabindex="0"><p>${item.content}</p>${tools}</div>`;
};
const ref = (opts, cols = 4) => {
    const pattern = opts.editable
        ? `<div class="absolute inset-0 pointer-events-none overflow-hidden" style="background-image:radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0);background-size:calc((100% + ${GAP}px) / ${cols}) calc(${ROW}px + ${GAP}px)"></div>`
        : '';
    return `<ui-bento-grid style="display:flex;flex-direction:column;height:100%"><div class="grid w-full relative grid-cols-12 min-h-full" data-slot="bento-grid" style="grid-template-columns:repeat(${cols}, minmax(0, 1fr));grid-auto-rows:${ROW}px;gap:${GAP}px">${pattern}${LAYOUT.map((item) => cardRef(item, opts)).join('')}</div></ui-bento-grid>`;
};
const el = (attrs) => `<ge-bento-grid cols="4" row-height="${ROW}" gap="${GAP}" ${attrs} data-props='${JSON.stringify({ items: LAYOUT })}'></ge-bento-grid>`;
const staticRef = `<ui-bento-grid style="display:flex;flex-direction:column;height:100%"><div class="grid w-full relative grid-cols-12 min-h-full" data-slot="bento-grid" style="grid-template-columns:repeat(3, minmax(0, 1fr));grid-auto-rows:60px;gap:16px"><div class="absolute inset-0 pointer-events-none overflow-hidden" style="background-image:radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0);background-size:calc((100% + 16px) / 3) calc(60px + 16px)"></div>`
    + `<ui-bento-grid-item class="contents"><div class="group/bento row-span-1 flex flex-col justify-between space-y-4 rounded-xl border bg-white p-4 shadow-input shadow-none transition duration-200 hover:shadow-xl dark:border-white/[0.2] dark:bg-black dark:shadow-none overflow-hidden" data-slot="bento-grid-item" style="grid-column:span 2;grid-row:span 2">Wide</div></ui-bento-grid-item>`
    + `<ui-bento-grid-item class="contents"><div class="group/bento row-span-1 flex flex-col justify-between space-y-4 rounded-xl border bg-white p-4 shadow-input shadow-none transition duration-200 hover:shadow-xl dark:border-white/[0.2] dark:bg-black dark:shadow-none overflow-hidden" data-slot="bento-grid-item" style="grid-column:span 1;grid-row:span 1">Small</div></ui-bento-grid-item>`
    + `</div></ui-bento-grid>`;
export default {
    name: 'bento-grid',
    items: [
        { id: 'read-only-bordered', wrap: 'width:624px;', ref: ref({ editable: false, bordered: true }), el: el('editable="false"') },
        { id: 'read-only-plain', wrap: 'width:624px;', ref: ref({ editable: false, bordered: false }), el: el('editable="false" show-borders="false"') },
        { id: 'editable', wrap: 'width:624px;', ref: ref({ editable: true, bordered: true }), el: el('') },
        { id: 'radius-and-padding', wrap: 'width:624px;', ref: ref({ editable: false, bordered: true, radius: '4px', padding: '8px' }), el: el('editable="false" border-radius="4" item-padding="8"') },
        { id: 'static-items', wrap: 'width:624px;', ref: staticRef, el: `<ge-bento-grid cols="3" row-height="60" gap="16"><ge-bento-grid-item span="2" row-span="2">Wide</ge-bento-grid-item><ge-bento-grid-item>Small</ge-bento-grid-item></ge-bento-grid>` },
    ],
};
