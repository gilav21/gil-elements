// shadcn-angular date-picker.component.html/.ts and sub/date-range-picker.component.html/.ts, closed state:
// the open panel is promoted to the top layer in Angular, which static markup cannot show; calendar.mjs covers its content.
const BUTTON = (width) => `inline-flex w-full sm:w-[${width}px] items-center justify-start rounded-md border border-input bg-background text-sm font-normal ring-offset-background hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`;
const ICON = (spacing) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${spacing} h-4 w-4"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`;

const ref = ({ slot = 'date-picker', width = 240, spacing = 'ltr:mr-2 rtl:ml-2', text, placeholder, disabled = false }) =>
    `<ui-${slot} class="contents"><div class="relative" data-slot="${slot}"><button type="button" class="${BUTTON(width)}" ${disabled ? 'disabled' : ''} aria-expanded="false" aria-haspopup="dialog">${ICON(spacing)}${text ? `<span>${text}</span>` : `<span class="text-muted-foreground">${placeholder}</span>`}</button></div></ui-${slot}>`;
const SINGLE = 'May 14, 2026';
const el = (tag, attrs = '', prop = '') => `<ge-${tag} ${attrs} ${prop}></ge-${tag}>`;

const W = 'width:22rem;';
const range = { slot: 'date-range-picker', width: 300, spacing: 'me-2', placeholder: 'Pick a date range' };
export default {
    name: 'date-picker',
    items: [
        { id: 'placeholder', wrap: W, ref: ref({ placeholder: 'Pick a date' }), el: el('date-picker') },
        { id: 'custom-placeholder', wrap: W, ref: ref({ placeholder: 'Birth date' }), el: el('date-picker', 'placeholder="Birth date"') },
        { id: 'value', wrap: W, ref: ref({ text: SINGLE }), el: el('date-picker', 'date="2026-05-14"') },
        { id: 'value-with-time', wrap: 'width:26rem;', ref: ref({ text: 'May 14, 2026 at 09:30 AM', width: 320 }), el: el('date-picker', 'show-time style="--_width:320px"', 'data-date="2026-05-14T09:30"') },
        { id: 'disabled', wrap: W, ref: ref({ placeholder: 'Pick a date', disabled: true }), el: el('date-picker', 'disabled') },
        { id: 'density-1.5', wrap: `${W}--density:1.5;`, ref: ref({ placeholder: 'Pick a date' }), el: el('date-picker') },
        { id: 'rtl', wrap: W, ref: `<div dir="rtl">${ref({ placeholder: 'Pick a date' })}</div>`, el: `<div dir="rtl">${el('date-picker')}</div>` },
        { id: 'narrow', wrap: 'width:12rem;', ref: ref({ text: 'May 14, 2026' }), el: el('date-picker', 'date="2026-05-14"') },
        { id: 'range-placeholder', wrap: 'width:24rem;', ref: ref({ ...range }), el: el('date-range-picker') },
        { id: 'range-complete', wrap: 'width:24rem;', ref: ref({ ...range, text: 'May 8, 2026 - May 15, 2026' }), el: el('date-range-picker', '', 'data-range=\'{"start":"2026-05-08","end":"2026-05-15"}\'') },
        { id: 'range-half-open', wrap: 'width:24rem;', ref: ref({ ...range, text: 'May 8, 2026 - ...' }), el: el('date-range-picker', '', 'data-range=\'{"start":"2026-05-08","end":null}\'') },
        { id: 'range-disabled', wrap: 'width:24rem;', ref: ref({ ...range, disabled: true }), el: el('date-range-picker', 'disabled') },
    ],
};
