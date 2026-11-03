// shadcn-angular input-group.component.ts (inputGroupVariants) and sub/*: the class strings, copied.
const BASE = 'group/input-group relative flex w-full items-center transition-[color,box-shadow] outline-none min-w-0 has-[input:focus-visible]:ring-[3px]';
// cn() is tailwind-merge: the ring-0 of underline and ghost replaces the base ring-[3px].
const VARIANT = {
    outline: 'rounded-md border border-input shadow-xs has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-ring/50',
    underline: 'rounded-none border-b border-input has-[input:focus-visible]:border-ring px-0 has-[input:focus-visible]:ring-0',
    ghost: 'border-none shadow-none has-[input:focus-visible]:ring-0',
};
const ADDON = 'text-muted-foreground flex h-auto items-center justify-center gap-2 text-sm font-medium select-none [&>svg:not([class*=size-])]:size-4';
const INPUT = 'flex-1 min-w-0 bg-transparent text-base md:text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
const TEXT = 'text-muted-foreground text-sm';
const SEARCH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

const addon = (align, inner) => `<ui-input-group-addon class="contents"><div class="${ADDON}" data-slot="input-group-addon" data-align="${align}">${inner}</div></ui-input-group-addon>`;
const field = (placeholder, value = '', disabled = false) => `<ui-input-group-input class="contents"><input type="text" class="${INPUT}" data-slot="input-group-control" placeholder="${placeholder}" ${disabled ? 'disabled' : ''} ${value ? `value="${value}"` : ''}></ui-input-group-input>`;
const text = (t) => `<span class="${TEXT}" data-slot="input-group-text">${t}</span>`;
const ref = ({ variant = 'outline', disabled = false, start, end, placeholder = 'Search', value = '' }) =>
    `<ui-input-group class="contents"><fieldset class="${variant === 'outline' ? BASE : BASE.replace(' has-[input:focus-visible]:ring-[3px]', '')} ${VARIANT[variant]}${disabled ? ' opacity-50 cursor-not-allowed' : ''} min-w-0" data-slot="input-group" ${disabled ? 'disabled data-disabled="true"' : ''}>${start ? addon('inline-start', start.ref) : ''}${field(placeholder, value, disabled)}${end ? addon('inline-end', end.ref) : ''}</fieldset></ui-input-group>`;
const el = ({ variant, disabled = false, start, end, placeholder = 'Search', value = '', focus = false }) =>
    `<ge-input-group${variant ? ` variant="${variant}"` : ''}${disabled ? ' disabled' : ''}>${start ? `<ge-input-group-addon>${start.el}</ge-input-group-addon>` : ''}<ge-input-group-input placeholder="${placeholder}"${value ? ` value="${value}"` : ''}></ge-input-group-input>${end ? `<ge-input-group-addon align="inline-end">${end.el}</ge-input-group-addon>` : ''}</ge-input-group>`;

const ICON = { ref: SEARCH, el: SEARCH };
const URL_ = { ref: text('https://'), el: '<ge-input-group-text>https://</ge-input-group-text>' };
const USD = { ref: text('USD'), el: '<ge-input-group-text>USD</ge-input-group-text>' };
const W = 'width:22rem;';
const F = { ref: 'input', el: 'input' };
export default {
    name: 'input-group',
    items: [
        { id: 'icon-start', wrap: W, ref: ref({ start: ICON }), el: el({ start: ICON }) },
        { id: 'text-start-and-end', wrap: W, ref: ref({ start: URL_, end: USD, placeholder: 'example.com' }), el: el({ start: URL_, end: USD, placeholder: 'example.com' }) },
        { id: 'value', wrap: W, ref: ref({ start: ICON, value: 'angular' }), el: el({ start: ICON, value: 'angular' }) },
        { id: 'field-only', wrap: W, ref: ref({}), el: el({}) },
        ...['underline', 'ghost'].map((variant) => ({ id: variant, wrap: W, ref: ref({ variant, start: ICON }), el: el({ variant, start: ICON }) })),
        { id: 'disabled', wrap: W, ref: ref({ start: ICON, disabled: true }), el: el({ start: ICON, disabled: true }) },
        { id: 'focus', wrap: W, focus: F, ref: ref({ start: ICON, value: 'angular' }), el: el({ start: ICON, value: 'angular' }) },
        { id: 'ghost-focus', wrap: W, focus: F, ref: ref({ variant: 'ghost', start: ICON, value: 'angular' }), el: el({ variant: 'ghost', start: ICON, value: 'angular' }) },
        { id: 'underline-focus', wrap: W, focus: F, ref: ref({ variant: 'underline', start: ICON }), el: el({ variant: 'underline', start: ICON }) },
        { id: 'density-1.5', wrap: `${W}--density:1.5;`, ref: ref({ start: ICON }), el: el({ start: ICON }) },
        { id: 'rtl', wrap: W, ref: `<div dir="rtl">${ref({ start: URL_, end: USD, placeholder: 'example.com' })}</div>`, el: `<div dir="rtl">${el({ start: URL_, end: USD, placeholder: 'example.com' })}</div>` },
    ],
};
