// shadcn-angular data-list.component.ts/.html and sub/data-list-item.component.html: the class strings, copied.
const DT = 'min-w-0 break-words font-medium text-muted-foreground';
const DD = 'min-w-0 break-words text-foreground';
const LIST = (o) => `grid grid-cols-1 text-sm ${o === 'horizontal' ? 'gap-x-4 gap-y-3 sm:grid-cols-[minmax(6rem,12rem)_1fr]' : 'gap-3'}`;
const row = (label, value) => `<dt class="${DT}" data-slot="data-list-label">${label}</dt><dd class="${DD}" data-slot="data-list-value">${value}</dd>`;
const ref = (o, rows) => `<ui-data-list class="block" data-orientation="${o}" data-slot="data-list"><dl class="${LIST(o)}" data-slot="data-list-content">${rows.map(([l, v]) => row(l, v)).join('')}</dl></ui-data-list>`;

const ROWS = [['Name', 'Ada Lovelace'], ['Email', 'ada@example.com'], ['Plan', 'Pro, billed yearly'], ['Address', '12 St James Square, London, SW1Y 4JH, United Kingdom']];
const LONG = [['Reference', 'A-very-long-unbroken-identifier-0123456789-abcdefghijklmnopqrstuvwxyz'], ...ROWS.slice(0, 2)];
const slotted = (o, rows) => `<ge-data-list orientation="${o}">${rows.map(([l, v]) => `<ge-data-list-item label="${l}">${v}</ge-data-list-item>`).join('')}</ge-data-list>`;
const data = (o, rows) => `<ge-data-list orientation="${o}" data-items='${JSON.stringify(rows.map(([label, value]) => ({ label, value })))}'></ge-data-list>`;
const W = 'width:36rem;';
const N = 'width:18rem;';
export default {
    name: 'data-list',
    items: [
        { id: 'vertical-data', wrap: W, ref: ref('vertical', ROWS), el: data('vertical', ROWS) },
        { id: 'horizontal-data', wrap: W, ref: ref('horizontal', ROWS), el: data('horizontal', ROWS) },
        { id: 'vertical-slotted', wrap: W, ref: ref('vertical', ROWS), el: slotted('vertical', ROWS) },
        { id: 'horizontal-slotted', wrap: W, ref: ref('horizontal', ROWS), el: slotted('horizontal', ROWS) },
        { id: 'horizontal-long-value', wrap: N, ref: ref('horizontal', LONG), el: data('horizontal', LONG) },
        { id: 'rtl-horizontal', wrap: W, ref: `<div dir="rtl">${ref('horizontal', ROWS)}</div>`, el: `<div dir="rtl">${data('horizontal', ROWS)}</div>` },
    ],
};
