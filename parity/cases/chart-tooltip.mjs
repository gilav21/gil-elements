// shadcn-angular chart-tooltip.component.html and .ts (classes, rows).
const ROWS = [
    { label: 'Revenue', value: '$1,200', color: 'hsl(221, 83%, 53%)' },
    { label: 'Costs', value: '$800', color: 'hsl(142, 71%, 45%)' },
    { label: 'Notes', value: '3' },
];
const ref = ({ title, rows = ROWS, flipX = false, flipY = false } = {}) => {
    const cls = `pointer-events-none absolute z-50 max-w-[calc(100vw-2rem)] rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg${flipX ? ' -translate-x-full' : ''}${flipY ? ' -translate-y-full' : ''}`;
    const head = title ? `<div class="mb-1 font-medium">${title}</div>` : '';
    const body = rows
        .map((row) => `<div class="flex items-center gap-2">${row.color ? `<span class="inline-block size-2 shrink-0 rounded-full" style="background:${row.color}"></span>` : ''}<span class="text-muted-foreground">${row.label}</span><span class="ml-auto font-medium tabular-nums">${row.value}</span></div>`)
        .join('');
    return `<div style="position:relative;height:9rem"><ui-chart-tooltip class="contents"><div class="${cls}" data-slot="chart-tooltip" role="tooltip" style="left:140px;top:70px">${head}${body}</div></ui-chart-tooltip></div>`;
};
const el = ({ title, rows = ROWS, flipX = false, flipY = false } = {}) =>
    `<div style="position:relative;height:9rem"><ge-chart-tooltip visible x="140" y="70"${title ? ` heading="${title}"` : ''}${flipX ? ' flip-x' : ''}${flipY ? ' flip-y' : ''} data-props='${JSON.stringify({ rows })}'></ge-chart-tooltip></div>`;
const pair = (id, opts) => ({ id, wrap: 'width:20rem;', ref: ref(opts), el: el(opts) });

export default {
    name: 'chart-tooltip',
    items: [
        pair('with-heading', { title: 'January' }),
        pair('rows-only'),
        pair('flip-x', { title: 'January', flipX: true }),
        pair('flip-y', { title: 'January', flipY: true }),
        pair('flip-both', { title: 'January', flipX: true, flipY: true }),
        pair('single-row', { rows: [{ label: 'Revenue', value: '$1,200' }] }),
    ],
};
