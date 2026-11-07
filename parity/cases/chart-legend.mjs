// shadcn-angular chart-legend.component.html and .ts (classes, item classes).
const ITEMS = [
    { key: 'a', label: 'Revenue', color: 'hsl(221, 83%, 53%)' },
    { key: 'b', label: 'Costs', color: 'hsl(142, 71%, 45%)' },
    { key: 'c', label: 'Profit', color: 'hsl(38, 92%, 50%)' },
];
const ref = ({ position = 'bottom', hidden = [], interactive = true } = {}) => {
    const col = position === 'left' || position === 'right' ? ' flex-col items-start' : '';
    const items = ITEMS.map((item) => {
        const off = hidden.includes(item.key);
        const cls = `inline-flex items-center gap-1.5 ${interactive ? 'cursor-pointer select-none ' : ''}${off ? 'opacity-70' : ''}`;
        const a11y = interactive ? ` role="button" tabindex="0" aria-pressed="${!off}"` : '';
        return `<span data-slot="chart-legend-item" class="${cls}"${a11y} aria-label="${item.label}"><span class="inline-block size-2.5 shrink-0 rounded-[2px]" style="background:${item.color}"></span><span class="${off ? 'line-through' : ''}">${item.label}</span></span>`;
    }).join('');
    return `<ui-chart-legend class="contents"><div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm${col}" data-slot="chart-legend">${items}</div></ui-chart-legend>`;
};
const el = ({ position = 'bottom', hidden = [], interactive = true } = {}) =>
    `<ge-chart-legend position="${position}"${interactive ? '' : ' interactive="false"'} data-props='${JSON.stringify({ items: ITEMS, hiddenKeys: hidden })}'></ge-chart-legend>`;
const pair = (id, opts, extra = {}) => ({ id, wrap: 'width:24rem;', ref: ref(opts), el: el(opts), ...extra });

export default {
    name: 'chart-legend',
    items: [
        pair('bottom'),
        pair('top', { position: 'top' }),
        pair('left', { position: 'left' }),
        pair('right', { position: 'right' }),
        pair('hidden-series', { hidden: ['b'] }),
        pair('read-only', { interactive: false }),
        pair('read-only-hidden', { interactive: false, hidden: ['a', 'c'] }),
        { id: 'narrow-wraps', wrap: 'width:12rem;', ref: ref(), el: el() },
    ],
};
