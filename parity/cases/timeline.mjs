// shadcn-angular timeline.component.ts and sub/timeline-*.component.ts.
// The 2rem gap comes from timeline-item.component.css, keyed on the host (shadcn-angular#226), so the reference carries it in reference.css.
const DOT = {
    default: 'border-border bg-background',
    filled: 'border-primary bg-primary text-primary-foreground',
    outline: 'border-primary bg-background',
    success: 'border-green-500 bg-green-500 text-white',
    error: 'border-destructive bg-destructive text-destructive-foreground',
    warning: 'border-yellow-500 bg-yellow-500 text-white',
};
const dot = (v = 'default', inner = '') => `<ui-timeline-dot class="contents"><div class="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${DOT[v]}" data-slot="timeline-dot">${inner}</div></ui-timeline-dot>`;
const connector = '<ui-timeline-connector class="contents"><div class="absolute top-6 h-[calc(100%-24px)] w-0.5 bg-border" data-slot="timeline-connector"></div></ui-timeline-connector>';
const header = (v, connect = true, inner = '') => `<ui-timeline-header class="contents"><div class="flex flex-col items-center" data-slot="timeline-header">${dot(v, inner)}${connect ? connector : ''}</div></ui-timeline-header>`;
const title = (t) => `<ui-timeline-title class="contents"><h4 class="text-sm font-semibold leading-none" data-slot="timeline-title">${t}</h4></ui-timeline-title>`;
const desc = (t) => `<ui-timeline-description class="contents"><p class="mt-1 text-sm text-muted-foreground" data-slot="timeline-description">${t}</p></ui-timeline-description>`;
const time = (t) => `<ui-timeline-time class="contents"><time class="text-xs text-muted-foreground" data-slot="timeline-time">${t}</time></ui-timeline-time>`;
const content = (inner) => `<ui-timeline-content class="contents"><div class="flex-1 pt-0.5" data-slot="timeline-content">${inner}</div></ui-timeline-content>`;
const wrapItem = (inner) => `<ui-timeline-item class="contents"><div class="relative flex gap-4" data-slot="timeline-item">${inner}</div></ui-timeline-item>`;
const simple = ({ t, d, tm, v = 'default', connect = true }) => {
    // Simple mode renders the same parts as inline markup instead of host elements.
    const parts = `${t ? `<h4 class="text-sm font-semibold leading-none" data-slot="timeline-title">${t}</h4>` : ''}${d ? `<p class="mt-1 text-sm text-muted-foreground" data-slot="timeline-description">${d}</p>` : ''}${tm ? `<time class="text-xs text-muted-foreground" data-slot="timeline-time">${tm}</time>` : ''}`;
    return wrapItem(`<div class="flex flex-col items-center" data-slot="timeline-header"><div class="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${DOT[v]}" data-slot="timeline-dot"></div>${connect ? '<div class="absolute top-6 h-[calc(100%-24px)] w-0.5 bg-border" data-slot="timeline-connector"></div>' : ''}</div><div class="flex-1 pt-0.5" data-slot="timeline-content">${parts}</div>`);
};
const root = (o, inner) => `<ui-timeline class="block"><div class="relative ${o === 'vertical' ? 'flex flex-col' : 'flex flex-row'}" data-slot="timeline">${inner}</div></ui-timeline>`;

const EVENTS = [
    { t: 'Version 2.0 released', d: 'Major update with new features.', tm: 'January 2024', v: 'success' },
    { t: 'Beta started', d: 'Invited the first testers.', tm: 'November 2023', v: 'filled' },
    { t: 'Build failed', tm: 'October 2023', v: 'error' },
    { t: 'Kickoff' },
];
const refSimple = (o, list = EVENTS) => root(o, list.map((e) => simple(e)).join(''));
const el = (e) => `<ge-timeline-item${e.t ? ` heading="${e.t}"` : ''}${e.d ? ` description="${e.d}"` : ''}${e.tm ? ` time="${e.tm}"` : ''}${e.v ? ` variant="${e.v}"` : ''}${e.connect === false ? ' hide-connector' : ''}></ge-timeline-item>`;
const elSimple = (o, list = EVENTS) => `<ge-timeline orientation="${o}">${list.map(el).join('')}</ge-timeline>`;

const ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
const refCustom = root('vertical', wrapItem(`${header('filled', true, ICON)}${content(`${title('Custom item')}${desc('Dot, connector and content are slotted.')}${time('Today')}`)}`) + wrapItem(`${header('outline', false)}${content(title('Last one'))}`));
const elCustom = `<ge-timeline><ge-timeline-item><ge-timeline-header><ge-timeline-dot variant="filled">${ICON}</ge-timeline-dot><ge-timeline-connector></ge-timeline-connector></ge-timeline-header><ge-timeline-content><ge-timeline-title>Custom item</ge-timeline-title><ge-timeline-description>Dot, connector and content are slotted.</ge-timeline-description><ge-timeline-time>Today</ge-timeline-time></ge-timeline-content></ge-timeline-item><ge-timeline-item><ge-timeline-header><ge-timeline-dot variant="outline"></ge-timeline-dot></ge-timeline-header><ge-timeline-content><ge-timeline-title>Last one</ge-timeline-title></ge-timeline-content></ge-timeline-item></ge-timeline>`;

const W = 'display:block;width:480px;';
const VARIANTS = Object.keys(DOT).map((v) => ({ t: v, v }));
const items = [
    { id: 'vertical', wrap: W, ref: refSimple('vertical'), el: elSimple('vertical') },
    { id: 'variants', wrap: W, ref: refSimple('vertical', VARIANTS), el: elSimple('vertical', VARIANTS) },
    { id: 'no-connector', wrap: W, ref: root('vertical', simple({ t: 'No line', d: 'The dot stands alone.', connect: false })), el: elSimple('vertical', [{ t: 'No line', d: 'The dot stands alone.', connect: false }]) },
    { id: 'horizontal', wrap: W, ref: refSimple('horizontal', EVENTS.slice(0, 3)), el: elSimple('horizontal', EVENTS.slice(0, 3)) },
    { id: 'custom', wrap: W, ref: refCustom, el: elCustom },
    { id: 'rtl', wrap: W, ref: `<div dir="rtl">${refSimple('vertical', EVENTS.slice(0, 2))}</div>`, el: `<div dir="rtl">${elSimple('vertical', EVENTS.slice(0, 2))}</div>` },
];
export default { name: 'timeline', items };
