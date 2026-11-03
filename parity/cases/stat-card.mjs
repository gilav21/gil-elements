// shadcn-angular stat-card.component.html: the card, header and content class strings, copied.
const SURFACE = 'bg-card text-card-foreground flex flex-col rounded-xl border shadow-sm';
const HEADER = '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start';
const CLIP = 'min-w-0 overflow-x-clip text-ellipsis whitespace-nowrap';
const BADGE = 'inline-flex items-center rounded-md border text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';
const VARIANT = {
    up: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
    down: 'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
    neutral: 'border-border bg-secondary text-secondary-foreground hover:bg-secondary/80',
};
const ARROW = {
    up: 'M12 19V5m0 0-7 7m7-7 7 7',
    down: 'M12 5v14m0 0 7-7m-7 7-7-7',
};
const svg = (trend) => `<svg data-slot="stat-card-trend" data-trend="${trend}" aria-hidden="true" class="size-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ARROW[trend]}"/></svg>`;

const ref = ({ label = 'Total Revenue', value = '$45,231.89', delta, trend = 'neutral', icon = true, extra = '' }) => {
    const arrow = icon && ARROW[trend];
    const badge = delta ? `<ui-badge data-slot="badge" class="${BADGE} ${VARIANT[trend]}${arrow ? ' gap-1' : ''}">${arrow ? svg(trend) : ''}${delta}</ui-badge>` : '';
    const content = badge || extra ? `<ui-card-content data-slot="card-content">${badge}${extra}</ui-card-content>` : '<ui-card-content data-slot="card-content" class="hidden"></ui-card-content>';
    return `<ui-stat-card class="contents" data-slot="stat-card"><div data-slot="card" class="${SURFACE}"><ui-card-header data-slot="card-header" class="${HEADER}"><ui-card-description class="text-muted-foreground text-sm ${CLIP}">${label}</ui-card-description><ui-card-title class="leading-none font-semibold ${CLIP}">${value}</ui-card-title></ui-card-header>${content}</div></ui-stat-card>`;
};
const el = ({ label = 'Total Revenue', value = '$45,231.89', delta, trend, icon = true, extra = '' }) =>
    `<ge-stat-card label="${label}" value="${value}"${delta ? ` delta="${delta}"` : ''}${trend ? ` trend="${trend}"` : ''}${icon ? '' : ' hide-trend-icon'}>${extra}</ge-stat-card>`;

const W = 'width:16rem;';
const SPARK = '<div style="height:40px;margin-top:8px;border-radius:6px;background:linear-gradient(90deg,#8884,#8888)"></div>';
const cases = [
    ['neutral', { delta: '+0.4%' }],
    ['up', { delta: '+20.1%', trend: 'up' }],
    ['down', { delta: '-4.3%', trend: 'down' }],
    ['no-arrow', { delta: '+20.1%', trend: 'up', icon: false }],
    ['no-delta', {}],
    ['sparkline', { delta: '+20.1%', trend: 'up', extra: SPARK }],
    ['sparkline-only', { label: 'Active users', value: '2,350', extra: SPARK }],
];
export default {
    name: 'stat-card',
    items: [
        ...cases.map(([id, o]) => ({ id, wrap: W, ref: ref(o), el: el(o) })),
        { id: 'truncates', wrap: 'width:11rem;', ref: ref({ label: 'Total recurring revenue this quarter', value: '$1,234,567,890.12', delta: '+20.1%', trend: 'up' }), el: el({ label: 'Total recurring revenue this quarter', value: '$1,234,567,890.12', delta: '+20.1%', trend: 'up' }) },
        { id: 'density-1.5', wrap: `${W}--density:1.5;`, ref: ref({ delta: '+20.1%', trend: 'up' }), el: el({ delta: '+20.1%', trend: 'up' }) },
        { id: 'rtl', wrap: W, ref: `<div dir="rtl">${ref({ delta: '+20.1%', trend: 'up' })}</div>`, el: `<div dir="rtl">${el({ delta: '+20.1%', trend: 'up' })}</div>` },
    ],
};
