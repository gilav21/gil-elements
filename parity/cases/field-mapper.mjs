// shadcn-angular field-mapper.component.html (wide and rows layouts) with its component CSS mirrored in reference.css.
// The case wrapper pins the mapper's width, so the container-width switch to rows is decided by the wrapper.
import { refPlain } from './input.mjs';
import { ref as button } from '../lib/button-ref.mjs';

export const isolated = true;

const ORDERS = ['customer_id', 'region', 'order_id', 'placed_at'];
const CUSTOMERS = ['segment', 'id', 'name', 'area'];
const X = '<ui-icon><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ui-icon ui-icon-x" data-slot="icon"><path d="m6 6 12 12" /><path d="M18 6 6 18" /></svg></ui-icon>';
const SELECT = 'border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground min-w-0 appearance-none rounded-md border bg-transparent text-sm shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-11 w-full';
const CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground pointer-events-none absolute top-1/2 ltr:right-3.5 rtl:left-3.5 size-4 -translate-y-1/2 opacity-50 select-none" aria-hidden="true" data-slot="native-select-icon"><path d="m6 9 6 6 6-6"/></svg>';

const INSTRUCTIONS = 'Arrow keys move. Enter picks an item; pick one in the other list to link them. Delete removes links. Or drag from the dot.';
const LIVE = '<div class="sr-only" aria-live="polite" aria-atomic="true" data-slot="field-mapper-live"></div>';
const label = (text) => `<span class="block truncate" dir="auto">${text}</span>`;

const item = (side, id, row, { linked = false, state = '', disabled = false } = {}) => {
    const handle = `<span class="field-mapper-handle" data-slot="field-mapper-handle" data-side="${side}" data-id="${id}"><span class="field-mapper-dot"></span></span>`;
    const content = `<div class="min-w-0 flex-1">${label(id)}</div>`;
    return `<div role="option" class="field-mapper-item relative z-[1] flex min-h-11 min-w-0 items-center rounded-md border bg-card" style="grid-column:${side === 'start' ? 1 : 3};grid-row:${row}" tabindex="-1" aria-selected="${state === 'choosing'}"${disabled ? ' aria-disabled="true"' : ''} data-slot="field-mapper-item" data-side="${side}" data-id="${id}"${state ? ` data-state="${state}"` : ''}${linked ? ' data-linked=""' : ''}>${side === 'start' ? content + handle : handle + content}</div>`;
};
const heading = (side, text, filter) =>
    `<div class="flex min-w-0 flex-col gap-2" style="grid-column:${side === 'start' ? 1 : 3}" data-slot="field-mapper-heading" data-side="${side}"><div class="truncate font-medium" dir="auto">${text}</div>${filter ? refPlain('outline', { placeholder: 'Filter…' }) : ''}</div>`;

/** `endOrder` is the aligned end list, top to bottom; `paths` the line paths measured from the real layout. */
const wide = ({ links = [], endOrder = CUSTOMERS, filters = false, disabled = [], states = {}, paths = [], tones = [], selected = -1, startHeading = 'From', endHeading = 'To', note = '', label = '' } = {}) => {
    const linkedStart = new Set(links.map(([s]) => s));
    const linkedEnd = new Set(links.map(([, e]) => e));
    const lines = paths
        .map((d, i) => `<path class="field-mapper-hit" d="${d}" data-slot="field-mapper-line-hit"/><path class="field-mapper-line" d="${d}" data-slot="field-mapper-line" data-tone="${tones[i] ?? 'default'}"${i === selected ? ' data-selected=""' : ''}/>`)
        .join('');
    return `<ui-field-mapper class="block"><div class="relative flex w-full min-w-0 flex-col gap-2 text-sm" data-slot="field-mapper" data-layout="columns"><div class="field-mapper-scroll relative overflow-auto overscroll-contain" data-slot="field-mapper-scroll"><div class="field-mapper-grid relative grid p-1" data-slot="field-mapper-grid"><div class="field-mapper-header bg-background sticky top-0 z-20 grid pb-2" style="grid-column:1 / -1;grid-row:1" data-slot="field-mapper-header">${heading('start', startHeading, filters)}${heading('end', endHeading, filters)}</div><svg class="pointer-events-none absolute left-0 top-0 z-0 overflow-visible" width="${paths.length ? 640 : 0}" height="${paths.length ? 244 : 0}" data-slot="field-mapper-lines" aria-hidden="true">${lines}</svg><div role="listbox" class="contents" data-slot="field-mapper-list" data-side="start">${ORDERS.map((id, i) => item('start', id, i + 2, { linked: linkedStart.has(id), disabled: disabled.includes(`start:${id}`), state: states[`start:${id}`] })).join('')}</div><div role="listbox" class="contents" data-slot="field-mapper-list" data-side="end">${endOrder.map((id, i) => item('end', id, i + 2, { linked: linkedEnd.has(id), disabled: disabled.includes(`end:${id}`), state: states[`end:${id}`] })).join('')}</div>${note}${label}</div></div><p class="sr-only">${INSTRUCTIONS}</p>${LIVE}</div></ui-field-mapper>`;
};

const rows = ({ links = {} } = {}) => {
    const row = (id) => {
        const partner = links[id] ?? '';
        return `<li class="flex min-w-0 flex-col gap-2 rounded-md border bg-card p-3" data-slot="field-mapper-row" data-id="${id}"><div class="min-w-0">${label(id)}</div><span class="text-muted-foreground -mb-1 text-xs" dir="auto" aria-hidden="true">To</span><ui-native-select class="h-11 w-full contents"><div class="group/native-select relative w-fit" data-slot="native-select-wrapper"><select class="${SELECT}" data-slot="native-select" data-size="default" aria-label="Link ${id} to"><option value="">Not linked</option>${CUSTOMERS.map((c) => `<option value="${c}"${c === partner ? ' selected' : ''}>${c}</option>`).join('')}</select>${CHEVRON}</div></ui-native-select></li>`;
    };
    return `<ui-field-mapper class="block"><div class="relative flex w-full min-w-0 flex-col gap-2 text-sm" data-slot="field-mapper" data-layout="rows"><div class="flex flex-col gap-2" data-slot="field-mapper-rows"><div class="flex flex-col gap-2"><div class="font-medium" dir="auto">From</div></div><ul class="flex flex-col gap-2">${ORDERS.map(row).join('')}</ul></div><p class="sr-only">${INSTRUCTIONS}</p>${LIVE}</div></ui-field-mapper>`;
};

const el = (attrs = '', props = {}) => `<ge-field-mapper ${attrs} data-props='${JSON.stringify({ start: ORDERS.map((id) => ({ id, label: id })), end: CUSTOMERS.map((id) => ({ id, label: id })), ...props })}'></ge-field-mapper>`;

const LINKS = [['customer_id', 'id'], ['order_id', 'area']];
const PATHS = ['M 243.15625 62 C 319.9921875 62 319.9921875 62 396.828125 62', 'M 243.15625 166 C 319.9921875 166 319.9921875 166 396.828125 166'];
const LINKED_END = ['id', 'segment', 'area', 'name'];
// tailwind-merge: rounded-full replaces the button's base rounded-lg.
const REMOVE = button('outline', 'icon', X, { extra: 'pointer-events-auto size-11 rounded-full' }).replace(' rounded-lg ', ' ');
const SELECTED_LABEL = `<div class="field-mapper-label pointer-events-none absolute z-10 flex flex-col items-center gap-1" style="left:319.9921875px;top:62px;max-width:151.671875px" data-slot="field-mapper-link-label">${REMOVE}</div>`;
const LINK_PROPS = { links: LINKS.map(([startId, endId]) => ({ startId, endId })) };
const W = 'width:664px;';
export default {
    name: 'field-mapper',
    items: [
        { id: 'columns-empty', wrap: W, ref: wide(), el: el() },
        { id: 'columns-filters', wrap: W, ref: wide({ filters: true }), el: el('searchable') },
        { id: 'columns-disabled-choosing', wrap: W, ref: wide({ disabled: ['end:name'], states: { 'start:region': 'choosing' } }), el: el('', { end: CUSTOMERS.map((id) => ({ id, label: id, disabled: id === 'name' })), pending: { side: 'start', id: 'region' } }) },
        { id: 'columns-links', wrap: W, ref: wide({ links: LINKS, endOrder: LINKED_END, paths: PATHS }), el: el('', LINK_PROPS) },
        { id: 'columns-tones', wrap: W, ref: wide({ links: LINKS, endOrder: LINKED_END, paths: PATHS, tones: ['muted', 'strong'] }), el: `${el('', LINK_PROPS).replace('<ge-field-mapper ', `<ge-field-mapper data-link-tones='${JSON.stringify({ 'customer_id>id': 'muted', 'order_id>area': 'strong' })}' `)}` },
        { id: 'columns-selected', wrap: W, ref: wide({ links: LINKS, endOrder: LINKED_END, paths: PATHS, selected: 0, label: SELECTED_LABEL }), el: el('', { ...LINK_PROPS, selectedLink: LINK_PROPS.links[0] }) },
        { id: 'rows', wrap: 'width:320px;', ref: rows(), el: el('') },
    ],
};
