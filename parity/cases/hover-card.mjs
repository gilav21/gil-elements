// shadcn-angular hover-card.component.ts, sub/hover-card-trigger.component.ts, sub/hover-card-content.component.ts (+ .css).
import { ref as button } from '../lib/button-ref.mjs';

const PANEL = 'absolute z-50 w-64 max-w-[calc(100vw-16px)] rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2';
const SIDE = { top: 'bottom-full mb-2', bottom: 'top-full mt-2' };
const ALIGN = { start: 'start-0', center: 'left-1/2 -translate-x-1/2', end: 'end-0' };

const simple = (title, description) => `<div class="space-y-1" data-slot="hover-card-simple-content"><h4 class="text-sm font-semibold">${title}</h4>${description ? `<p class="text-sm text-muted-foreground">${description}</p>` : ''}</div>`;
const SIMPLE = simple('@gilav21', 'Maintains shadcn-angular and the web components port.');
const CUSTOM = '<p class="text-sm">Anything you like goes here, in any markup.</p>';

const ref = (side, align, body = SIMPLE) =>
    `<ui-hover-card class="relative inline-block" data-slot="hover-card"><ui-hover-card-trigger class="contents"><span class="" tabindex="0" data-slot="hover-card-trigger">${button('link', 'default', '@gilav21')}</span></ui-hover-card-trigger><ui-hover-card-content class="contents"><div class="${PANEL} ${SIDE[side]} ${ALIGN[align]}" data-state="open" data-side="${side}" data-slot="hover-card-content" style="transform: translateX(0px);">${body}</div></ui-hover-card-content></ui-hover-card>`;
const elSimple = (heading, description) => `heading="${heading}"${description ? ` description="${description}"` : ''}`;
const el = (side, align, inner = '', attrs = elSimple('@gilav21', 'Maintains shadcn-angular and the web components port.')) =>
    `<ge-hover-card open><ge-hover-card-trigger><ge-button variant="link">@gilav21</ge-button></ge-hover-card-trigger><ge-hover-card-content side="${side}" align="${align}" ${attrs}>${inner}</ge-hover-card-content></ge-hover-card>`;
const elCustom = '<p style="margin:0;font-size:0.875rem;line-height:1.25rem">Anything you like goes here, in any markup.</p>';

// overflow:hidden makes the wrapper the clipping box, so collision handling does not depend on where the harness page puts the case.
const W = (extra = '') => `width:560px;height:240px;padding:120px 0 0 240px;box-sizing:content-box;overflow:hidden;${extra}`;
const items = [
    ...['top', 'bottom'].flatMap((side) => ['start', 'center', 'end'].map((align) => ({ id: `${side}-${align}`, wrap: W(), ref: ref(side, align), el: el(side, align) }))),
    { id: 'heading-only', wrap: W(), ref: ref('bottom', 'center', simple('@gilav21')), el: el('bottom', 'center', '', elSimple('@gilav21')) },
    { id: 'custom', wrap: W(), ref: ref('bottom', 'center', CUSTOM), el: el('bottom', 'center', elCustom, '') },
    { id: 'simple-and-custom', wrap: W(), ref: ref('bottom', 'center', SIMPLE + CUSTOM), el: el('bottom', 'center', elCustom) },
    { id: 'density-1.5', wrap: W('--density:1.5;'), ref: ref('bottom', 'center'), el: el('bottom', 'center') },
    { id: 'rtl-start', wrap: W(), ref: `<div dir="rtl">${ref('bottom', 'start')}</div>`, el: `<div dir="rtl">${el('bottom', 'start')}</div>` },
    { id: 'rtl-end', wrap: W('padding-left:0;padding-right:240px;'), ref: `<div dir="rtl">${ref('top', 'end')}</div>`, el: `<div dir="rtl">${el('top', 'end')}</div>` },
    { id: 'closed', wrap: W(), ref: ref('bottom', 'center').replace(/<ui-hover-card-content.*<\/ui-hover-card-content>/, ''), el: el('bottom', 'center').replace('<ge-hover-card open>', '<ge-hover-card>') },
];
export default { name: 'hover-card', items };
