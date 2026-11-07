// shadcn-angular split-button.component.ts and sub/*.component.ts.
import { ref as button } from '../lib/button-ref.mjs';

const CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-transform"><path d="m6 9 6 6 6-6"/></svg>';
const CHEVRON_OPEN = CHEVRON.replace('class="transition-transform"', 'class="rotate-180 transition-transform"');
const MENU = 'absolute z-50 min-w-[8rem] max-w-[calc(100vw-2rem)] top-full end-0 mt-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95';
const ITEM = 'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground';

const row = (text, disabled = false) =>
    `<button class="${ITEM}${disabled ? ' pointer-events-none opacity-50' : ''}" ${disabled ? 'disabled' : ''} role="menuitem" tabindex="-1">${text}</button>`;
const ROWS = [['Save as draft'], ['Save and close'], ['Archive', true]];

const ref = ({ variant = 'default', size = 'default', disabled = false, open = false } = {}) =>
    `<ui-split-button class="contents"><div class="relative inline-flex" data-slot="split-button" role="group">` +
    button(variant, size, 'Save', { extra: 'rounded-e-none border-e-0', disabled }) +
    button(variant, size, open ? CHEVRON_OPEN : CHEVRON, { extra: 'rounded-s-none px-2 border-s-current/25', disabled, host: 'aria-haspopup="menu" aria-label="More options"' }) +
    (open ? `<div class="${MENU}" role="menu" tabindex="-1">${ROWS.map(([text, off]) => row(text, off)).join('')}</div>` : '') +
    `</div></ui-split-button>`;

const attrs = (o) => `${o.variant ? ` variant="${o.variant}"` : ''}${o.size ? ` size="${o.size}"` : ''}${o.disabled ? ' disabled' : ''}${o.open ? ' open' : ''}`;
const DATA = 'data-items=\'[{"label":"Save as draft"},{"label":"Save and close"},{"label":"Archive","disabled":true}]\'';
const el = (o = {}) => `<ge-split-button label="Save"${attrs(o)} ${DATA}></ge-split-button>`;
const custom = (o = {}) =>
    `<ge-split-button${attrs(o)}><ge-split-button-primary>Save</ge-split-button-primary><ge-split-button-menu><ge-split-button-item>Save as draft</ge-split-button-item><ge-split-button-item>Save and close</ge-split-button-item><ge-split-button-item disabled>Archive</ge-split-button-item></ge-split-button-menu></ge-split-button>`;

const both = (id, o = {}, wrap = '') => ({ id, wrap, ref: ref(o), el: el(o) });
const open = (id, o = {}, extra = '', mode = el) => ({ id, wrap: `width:420px;height:200px;padding:12px 0 0 200px;box-sizing:content-box;${extra}`, ref: ref({ ...o, open: true }), el: mode({ ...o, open: true }) });

export default {
    name: 'split-button',
    isolated: true,
    items: [
        ...['default', 'secondary', 'outline', 'destructive', 'ghost'].map((variant) => both(variant, { variant })),
        both('sm', { size: 'sm' }),
        both('lg', { size: 'lg' }),
        both('disabled', { disabled: true }),
        both('outline-disabled', { variant: 'outline', disabled: true }),
        both('density-1.5', {}, '--density:1.5;'),
        both('density-0.75-outline', { variant: 'outline' }, '--density:0.75;'),
        { id: 'rtl', ref: `<div dir="rtl">${ref({ variant: 'outline' })}</div>`, el: `<div dir="rtl">${el({ variant: 'outline' })}</div>` },
        { id: 'custom-closed', ref: ref(), el: custom() },
        open('open'),
        open('open-outline', { variant: 'outline' }),
        open('open-sm', { size: 'sm' }),
        open('open-density-1.5', {}, '--density:1.5;'),
        open('open-custom', {}, '', custom),
        { id: 'open-rtl', wrap: 'width:420px;height:200px;padding:12px 200px 0 0;box-sizing:content-box;', ref: `<div dir="rtl">${ref({ open: true })}</div>`, el: `<div dir="rtl">${el({ open: true })}</div>` },
        { id: 'focused-toggle', focus: { ref: 'ui-button[aria-haspopup] button', el: 'ge-button[aria-haspopup]' }, ref: ref(), el: el() },
    ],
};
