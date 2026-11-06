// shadcn-angular virtual-scroll.component.html: a scrolling container (`relative h-full w-full contain-strict will-change-scroll`, overflow set per
// orientation) holding a padded flex box of the rows in the window. At rest that is the first rows up to the viewport plus the buffer, and the padding
// stands in for the rest. Rows are 50px tall (the estimate), so nothing is corrected.
const ROW = 'h-[50px] box-border flex items-center px-3 border-b';
const rowEl = (n) => `<div style="height:50px;box-sizing:border-box;display:flex;align-items:center;padding-inline:.75rem;border-bottom:1px solid var(--border)">Row ${n}</div>`;
const BOX = 'h-[300px] w-[300px] border rounded-md';
const BOX_EL = 'height:300px;width:300px;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px)';
const refV = (rendered, total) => `<div class="${BOX}"><ui-virtual-scroll class="contents"><div class="overflow-y-auto overflow-x-hidden relative h-full w-full contain-strict will-change-scroll" data-slot="virtual-scroll" data-orientation="vertical" tabindex="0"><div class="flex flex-col w-full min-h-full" style="padding-top:0px;padding-bottom:${(total - rendered) * 50}px">${Array.from({ length: rendered }, (_, n) => `<div class="virtual-item w-full" data-index="${n}"><div class="${ROW}">Row ${n}</div></div>`).join('')}</div></div></ui-virtual-scroll></div>`;
const elV = (total, attrs = '') => `<ge-virtual-scroll ${attrs} style="${BOX_EL}" data-props='${JSON.stringify({ items: Array.from({ length: total }, (_, id) => ({ id })) })}' data-render="rows"></ge-virtual-scroll>`;
const CELL = 'h-full w-[100px] box-border flex items-center justify-center border-r';
const refH = (rendered, total) => `<div class="h-[80px] w-[300px] border rounded-md"><ui-virtual-scroll class="contents"><div class="overflow-x-auto overflow-y-hidden relative h-full w-full contain-strict will-change-scroll" data-slot="virtual-scroll" data-orientation="horizontal" tabindex="0"><div class="flex flex-row h-full min-w-full" style="padding-inline-start:0px;padding-inline-end:${(total - rendered) * 100}px">${Array.from({ length: rendered }, (_, n) => `<div class="virtual-item shrink-0 h-full" data-index="${n}"><div class="${CELL}">${n}</div></div>`).join('')}</div></div></ui-virtual-scroll></div>`;
const elH = (total) => `<ge-virtual-scroll orientation="horizontal" min-item-width="100" style="height:80px;width:300px;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px)" data-props='${JSON.stringify({ items: Array.from({ length: total }, (_, id) => ({ id })) })}' data-render="cells"></ge-virtual-scroll>`;
const GCELL = 'h-[40px] w-[80px] box-border flex items-center justify-center border';
const refG = (columnsRendered, rowsRendered, columns, total) => {
    const rows = Math.ceil(total / columns);
    const out = [];
    for (let r = 0; r < rowsRendered; r++) {
        const cells = Array.from({ length: columnsRendered }, (_, c) => `<div class="virtual-item shrink-0" data-index="${r * columns + c}" data-row="${r}" data-column="${c}"><div class="${GCELL}">${r * columns + c}</div></div>`).join('');
        out.push(`<div class="virtual-row flex" data-row="${r}" style="padding-inline-start:0px;padding-inline-end:${(columns - columnsRendered) * 80}px">${cells}</div>`);
    }
    return `<div class="h-[120px] w-[240px] border rounded-md"><ui-virtual-scroll class="contents"><div class="overflow-auto relative h-full w-full contain-strict will-change-scroll" data-slot="virtual-scroll" data-orientation="both" tabindex="0"><div class="flex flex-col min-w-full min-h-full" style="padding-top:0px;padding-bottom:${(rows - rowsRendered) * 40}px">${out.join('')}</div></div></ui-virtual-scroll></div>`;
};
const elG = (columns, total) => `<ge-virtual-scroll orientation="both" column-count="${columns}" min-item-height="40" min-item-width="80" buffer="1" style="height:120px;width:240px;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px)" data-props='${JSON.stringify({ items: Array.from({ length: total }, (_, id) => ({ id })) })}' data-render="grid"></ge-virtual-scroll>`;
export default {
    name: 'virtual-scroll',
    items: [
        { id: 'vertical-list', ref: refV(11, 500), el: elV(500) },
        { id: 'short-list', ref: refV(4, 4), el: elV(4) },
        { id: 'horizontal-list', ref: refH(8, 200), el: elH(200) },
        { id: 'grid', ref: refG(4, 4, 20, 400), el: elG(20, 400) },
    ],
};
