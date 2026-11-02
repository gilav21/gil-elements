// shadcn-angular tooltip.component.ts, sub/tooltip-trigger.component.ts, sub/tooltip-content.component.ts (+ .html).
import { ref as button } from '../lib/button-ref.mjs';

const BUBBLE = 'absolute z-50 w-max max-w-[calc(100vw-2rem)] break-words overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground';
const SIDE = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};
const TEXT = 'Add to library';
const LONG = 'Adds this item to your library so you can find it again later, from any device you sign in on, whenever you need it.';

const ref = (side, { open = true, text = TEXT } = {}) =>
    `<ui-tooltip class="relative inline-block" data-slot="tooltip"><ui-tooltip-trigger class="contents"><span class="" data-slot="tooltip-trigger">${button('outline', 'default', 'Hover me')}</span></ui-tooltip-trigger>${open ? `<ui-tooltip-content class="contents"><div class="${BUBBLE} ${SIDE[side]}" data-slot="tooltip-content">${text}</div></ui-tooltip-content>` : ''}</ui-tooltip>`;
const el = (side, { open = true, text = TEXT } = {}) =>
    `<ge-tooltip content="${text}" side="${side}"${open ? ' open' : ''}><ge-tooltip-trigger><ge-button variant="outline">Hover me</ge-button></ge-tooltip-trigger></ge-tooltip>`;

const W = 'width:520px;height:200px;padding:80px 0 0 190px;box-sizing:content-box;';
const items = [
    ...['top', 'bottom', 'left', 'right'].map((side) => ({ id: side, wrap: W, ref: ref(side), el: el(side) })),
    { id: 'closed', wrap: W, ref: ref('top', { open: false }), el: el('top', { open: false }) },
    { id: 'rtl-left', wrap: W, ref: `<div dir="rtl">${ref('left')}</div>`, el: `<div dir="rtl">${el('left')}</div>` },
    { id: 'rtl-right', wrap: W, ref: `<div dir="rtl">${ref('right')}</div>`, el: `<div dir="rtl">${el('right')}</div>` },
    { id: 'long-text', wrap: W, ref: ref('top', { text: LONG }), el: el('top', { text: LONG }) },
    { id: 'custom-mode', wrap: W, ref: ref('bottom'), el: `<ge-tooltip side="bottom" open><ge-tooltip-trigger><ge-button variant="outline">Hover me</ge-button></ge-tooltip-trigger><ge-tooltip-content>${TEXT}</ge-tooltip-content></ge-tooltip>` },
];
export default { name: 'tooltip', items };
