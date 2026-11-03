// shadcn-angular calendar.component.html, getDayClasses and calendar.component.css: the class strings, copied.
import { ref as button } from '../lib/button-ref.mjs';

const CONTAINER = 'p-3 bg-background rounded-md border inline-block';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const PREV = '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>';
const NEXT = '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>';
const CLOCK = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
const INPUT = 'flex-1 w-full bg-transparent px-3 py-1 text-sm outline-none placeholder:text-muted-foreground rtl:pr-0 [&::-webkit-calendar-picker-indicator]:hidden flex rtl:justify-end';
const BOX = 'flex items-center rounded-md border border-input focus-within:ring-1 focus-within:ring-ring';
const ICON = 'flex items-center justify-center px-3 py-2 ltr:border-l rtl:border-r border-input bg-muted/50 text-muted-foreground';

const key = (y, m, d) => `${y}-${m}-${d}`;
// getDayClasses: cn() is tailwind-merge, so the later of two conflicting utilities wins.
const dayClasses = ({ today, selected, inRange, start, end }) => {
    const list = ['inline-flex h-9 w-9 items-center justify-center rounded-md text-sm', 'hover:bg-accent hover:text-accent-foreground', 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'];
    if (today && !selected) list.push('bg-accent text-accent-foreground');
    if (selected) list.push('bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground z-10');
    if (inRange && !selected) list.push('bg-accent/80 text-accent-foreground rounded-none');
    if (start) list.push('rounded-e-none');
    if (end) list.push('rounded-s-none');
    return list.join(' ');
};
const stripMerged = (html) =>
    html
        .replaceAll(' hover:bg-muted hover:text-foreground', '')
        .replaceAll(' focus-visible:ring-ring/50', '')
        .replaceAll(' focus-visible:ring-[3px]', '');

const grid = ({ year, month, startOn = 0, state = () => ({}) }) => {
    const first = new Date(year, month, 1).getDay();
    const lead = (first - startOn + 7) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div data-slot="calendar-filler"></div>');
    for (let d = 1; d <= count; d++) {
        cells.push(stripMerged(button('ghost', 'default', d, { extra: dayClasses({ today: false, ...state(d) }), host: `aria-label="${d}"` })));
    }
    return cells.join('');
};
const names = (startOn) => [...DAYS.slice(startOn), ...DAYS.slice(0, startOn)].map((d) => `<div class="py-2">${d}</div>`).join('');
const timeField = (id, label, value) => `<div class="flex flex-col gap-2"><label class="text-sm font-medium" for="${id}">${label}</label><div class="${BOX}"><input type="time" class="${INPUT}" value="${value}" id="${id}"><div class="${ICON}">${CLOCK}</div></div></div>`;

const ref = ({ year, month, startOn = 0, state, time = '' }) =>
    `<ui-calendar class="contents"><div class="${CONTAINER}" data-slot="calendar"><div class="flex items-center justify-between px-1 relative mb-4">${button('outline', 'icon-sm', PREV, { host: 'aria-label="Previous month"' })}<div class="flex items-center gap-1 font-medium text-sm"><span>${MONTHS[month]}</span><span>${year}</span></div>${button('outline', 'icon-sm', NEXT, { host: 'aria-label="Next month"' })}</div><div class="mt-4 grid grid-cols-7 text-center text-xs text-muted-foreground">${names(startOn)}</div><div class="grid grid-cols-7 gap-1">${grid({ year, month, startOn, state })}</div>${time}</div></ui-calendar>`;

const W = 'width:22rem;';
const Y = 2026;
const M = 4; // May 2026: starts on a Friday, 31 days
const pick = (day) => (d) => ({ selected: d === day });
const range = (a, b) => (d) => ({ selected: d === a || d === b, inRange: d > a && d < b, start: d === a, end: d === b });
const multi = (days) => (d) => ({ selected: days.includes(d) });
const single = '<ge-calendar selected="2026-05-14"></ge-calendar>';
const el = (attrs, props = '') => `<ge-calendar ${attrs} ${props ? `data-selected='${props}'` : ''}></ge-calendar>`;
export default {
    name: 'calendar',
    items: [
        { id: 'single', wrap: W, ref: ref({ year: Y, month: M, state: pick(14) }), el: single },
        { id: 'week-starts-monday', wrap: W, ref: ref({ year: Y, month: M, startOn: 1, state: pick(14) }), el: '<ge-calendar selected="2026-05-14" week-starts-on="1"></ge-calendar>' },
        { id: 'range', wrap: W, ref: ref({ year: Y, month: M, state: range(8, 15) }), el: el('mode="range"', '{"start":"2026-05-08","end":"2026-05-15"}') },
        { id: 'range-half-open', wrap: W, ref: ref({ year: Y, month: M, state: (d) => ({ selected: d === 8 }) }), el: el('mode="range"', '{"start":"2026-05-08","end":null}') },
        { id: 'multi', wrap: W, ref: ref({ year: Y, month: M, state: multi([4, 12, 20]) }), el: el('mode="multi"', '["2026-05-04","2026-05-12","2026-05-20"]') },
        { id: 'time-single', wrap: W, ref: ref({ year: Y, month: M, state: pick(14), time: `<div class="mt-4 border-t pt-4">${timeField('time', 'Time', '00:00')}</div>` }), el: '<ge-calendar selected="2026-05-14" show-time-select></ge-calendar>' },
        { id: 'time-range', wrap: W, ref: ref({ year: Y, month: M, state: range(8, 15), time: `<div class="mt-4 border-t pt-4"><div class="grid grid-cols-2 gap-3">${timeField('start-time', 'Start time', '09:30')}${timeField('end-time', 'End time', '17:45')}</div></div>` }), el: el('mode="range" show-time-select time-mode="range"', '{"start":"2026-05-08T09:30","end":"2026-05-15T17:45"}') },
        { id: 'density-1.5', wrap: `${W}--density:1.5;`, ref: ref({ year: Y, month: M, state: pick(14) }), el: single },
        { id: 'rtl', wrap: W, ref: `<div dir="rtl">${ref({ year: Y, month: M, state: pick(14) })}</div>`, el: `<div dir="rtl">${single}</div>` },
    ],
};
