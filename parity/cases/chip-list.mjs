// shadcn-angular chip-list.component.ts (chipListVariants, chipFont), .html and .css, with the badge and the ghost input it renders.
import { BASE as BADGE_BASE, VARIANTS as BADGE } from './badge.mjs';
import { BASE as INPUT_BASE, VARIANT as INPUT } from './input.mjs';

const BOX = 'w-full flex-wrap flex items-center px-1 transition-[color,box-shadow] outline-none has-[input:focus-visible]:ring-[3px]';
const VARIANTS = {
    outline: 'rounded-md border-input shadow-xs has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-ring/50',
    underline: 'rounded-none border-input has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-0',
    ghost: 'border-none shadow-none has-[input:focus-visible]:ring-0',
};
// px-1 and the underline's px-0 are tailwind-merged: the later one wins.
const boxClasses = (variant) => `${variant === 'underline' ? BOX.replace(' px-1', '') + ' px-0' : BOX} ${VARIANTS[variant]}`;
const FONT = { sm: 'text-[0.6875rem] leading-[0.875rem]', md: '', lg: 'text-sm leading-5' };
const X = '<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>';
const REMOVE = 'inline-flex h-4 w-4 pointer-coarse:size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 hover:bg-black/10 dark:hover:bg-white/10';
// The class input of ui-input lands on the native input: flex-1 min-w-[5rem] bg-transparent border-none outline-none shadow-none focus-visible:ring-0 p-0.
const FIELD = `${INPUT_BASE.replace('min-w-0', 'min-w-[5rem]')} ${INPUT.ghost.replace(' px-0', '')} flex-1 p-0`;

const chip = (text, { badge = 'default', size = 'md', disabled = false, color } = {}) => {
    const classes = `${size === 'lg' ? BADGE_BASE.replace(' text-xs', '') : BADGE_BASE} ${BADGE[color ? 'default' : badge]} shrink-0 gap-1 ${FONT[size]}${disabled ? '' : ' ltr:pr-1 rtl:pl-1'}`.replace(/ +/g, ' ');
    const style = color ? ` style="background-color: ${color[0]}; color: ${color[1]}; border-color: ${color[0]};"` : '';
    return `<ui-badge data-slot="badge" class="${classes}"${style}><span class="max-w-[7.5rem] sm:max-w-[12.5rem] truncate">${text}</span>${disabled ? '' : `<button type="button" class="${REMOVE}" data-slot="chip-remove" aria-label="Remove ${text}">${X}</button>`}</ui-badge>`;
};
const ref = ({ chips = [], variant = 'outline', size = 'md', disabled = false, maxRows = 0, badge, colors = {}, placeholder = 'Add item...' }) =>
    `<ui-chip-list class="contents"><fieldset class="${boxClasses(variant)}${disabled ? ' opacity-50 cursor-not-allowed' : ''}${maxRows > 0 ? ' overflow-y-auto' : ''} min-w-0" data-variant="${variant}" data-size="${size}" ${maxRows > 0 ? `data-max-rows style="--_rows: ${maxRows};"` : ''} data-slot="chip-list" ${disabled ? 'disabled data-disabled="true"' : ''} tabindex="-1">` +
    chips.map((c) => chip(c, { badge, size, disabled, color: colors[c] })).join('') +
    `<ui-input class="contents"><input class="${FIELD}" type="text" placeholder="${chips.length === 0 ? placeholder : ''}" aria-label="${placeholder}" ${disabled ? 'disabled' : ''} data-slot="input"></ui-input></fieldset></ui-chip-list>`;

const el = ({ chips = [], colors, ...rest }, extra = '') => {
    const attrs = Object.entries(rest).map(([k, v]) => (v === true ? k : `${k}="${v}"`)).join(' ');
    return `<ge-chip-list ${attrs}${extra} data-chips='${JSON.stringify(chips)}'${colors ? ` data-colors='${JSON.stringify(Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, v[0]])))}'` : ''}></ge-chip-list>`;
};
const MANY = ['Angular', 'React', 'Vue', 'Svelte', 'Lit', 'Solid', 'Qwik', 'Preact', 'Ember', 'Alpine', 'Stencil', 'Mithril'];
const THREE = ['Angular', 'React', 'Vue'];
const W = 'width:24rem;';
const both = (id, p, wrap = W, extra = '') => ({ id, wrap, ref: ref(p), el: el(p, extra) });
const COLORS = { Angular: ['#fde68a', '#000000'], React: ['#1e3a8a', '#ffffff'] };
const colorRef = { chips: THREE, colors: COLORS };

export default {
    name: 'chip-list',
    items: [
        both('empty', {}),
        both('custom-placeholder', { placeholder: 'Add a tag' }, W, ' placeholder="Add a tag"'),
        both('chips', { chips: THREE }),
        both('secondary', { chips: THREE, badge: 'secondary' }, W, ' badge-variant="secondary"'),
        both('outline-badge', { chips: THREE, badge: 'outline' }, W, ' badge-variant="outline"'),
        both('destructive', { chips: THREE, badge: 'destructive' }, W, ' badge-variant="destructive"'),
        both('colors', colorRef),
        both('underline', { chips: THREE, variant: 'underline' }, W, ' variant="underline"'),
        both('ghost', { chips: THREE, variant: 'ghost' }, W, ' variant="ghost"'),
        both('size-sm', { chips: THREE, size: 'sm' }, W, ' size="sm"'),
        both('size-lg', { chips: THREE, size: 'lg' }, W, ' size="lg"'),
        both('disabled', { chips: THREE, disabled: true }, W, ' disabled'),
        both('disabled-empty', { disabled: true }, W, ' disabled'),
        both('wraps', { chips: MANY }, 'width:20rem;'),
        both('max-rows-2', { chips: MANY, maxRows: 2 }, 'width:20rem;', ' max-rows="2"'),
        both('max-rows-2-sm', { chips: MANY, maxRows: 2, size: 'sm' }, 'width:20rem;', ' max-rows="2" size="sm"'),
        both('max-rows-3-lg-underline', { chips: MANY, maxRows: 3, size: 'lg', variant: 'underline' }, 'width:20rem;', ' max-rows="3" size="lg" variant="underline"'),
        both('long-text', { chips: ['A very long chip label that has to be cut short somewhere', 'Short'] }),
        both('density-1.5', { chips: THREE }, `${W}--density:1.5;`),
        both('density-0.75-lg', { chips: THREE, size: 'lg' }, `${W}--density:0.75;`, ' size="lg"'),
        { id: 'rtl', wrap: W, ref: `<div dir="rtl">${ref({ chips: THREE })}</div>`, el: `<div dir="rtl">${el({ chips: THREE })}</div>` },
        { id: 'focus', wrap: W, focus: { ref: 'input', el: 'input' }, ref: ref({ chips: THREE }), el: el({ chips: THREE }) },
    ],
};
