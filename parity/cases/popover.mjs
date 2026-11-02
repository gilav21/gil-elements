// shadcn-angular popover.component.ts, sub/popover-trigger.component.ts, sub/popover-content.component.ts (absolute strategy).
import { ref as button } from '../lib/button-ref.mjs';

const PANEL = 'z-50 w-72 max-w-[calc(100vw-16px)] rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95';
const SIDE = { top: 'bottom-full mb-1', bottom: 'top-full mt-1', left: 'right-full me-1 top-0', right: 'left-full ms-1 top-0' };
const ALIGN = { start: 'left-0', center: 'left-1/2 -translate-x-1/2', end: 'right-0' };

const ref = (side, align, { content = 'Set the dimensions for the layer.', trigger = button('outline', 'default', 'Open popover') } = {}) =>
    `<ui-popover class="relative inline-block" data-slot="popover"><ui-popover-trigger class="contents"><span class="" data-slot="popover-trigger">${trigger}</span></ui-popover-trigger><ui-popover-content class="contents"><div class="absolute ${PANEL} ${SIDE[side]} ${side === 'top' || side === 'bottom' ? ALIGN[align] : ''}" data-state="open" data-slot="popover-content"><div class="grid gap-2"><h4 class="font-medium leading-none">Dimensions</h4><p class="text-sm text-muted-foreground">${content}</p></div></div></ui-popover-content></ui-popover>`;
// Collision handling reads the viewport, and the harness stacks every case on one tall page, so it is switched off here
// (Angular's reference is static markup with no collision step); popover.browser.test.ts covers the nudge and flip.
const el = (side, align, { content = 'Set the dimensions for the layer.', trigger = '<ge-button variant="outline">Open popover</ge-button>', attrs = '' } = {}) =>
    `<ge-popover open><ge-popover-trigger>${trigger}</ge-popover-trigger><ge-popover-content side="${side}" align="${align}" no-collisions ${attrs}><div style="display:grid;gap:0.5rem"><h4 style="margin:0;font-weight:500;line-height:1">Dimensions</h4><p style="margin:0;font-size:0.875rem;line-height:1.25rem;color:var(--muted-foreground)">${content}</p></div></ge-popover-content></ge-popover>`;

// Room on every side of the trigger: the panel is 288px wide and about 90px tall.
const W = (extra = '') => `width:560px;height:260px;padding:130px 0 0 220px;box-sizing:content-box;${extra}`;
const sides = ['top', 'bottom', 'left', 'right'].flatMap((side) =>
    ['start', 'center', 'end'].map((align) => ({ id: `${side}-${align}`, wrap: W(), ref: ref(side, align), el: el(side, align) })),
);
const items = [
    ...sides,
    { id: 'density-1.5', wrap: W('--density:1.5;'), ref: ref('bottom', 'center'), el: el('bottom', 'center') },
    { id: 'rtl-start', wrap: W(), ref: `<div dir="rtl">${ref('bottom', 'start')}</div>`, el: `<div dir="rtl">${el('bottom', 'start')}</div>` },
    { id: 'rtl-left', wrap: W('direction:rtl;'), ref: `<div dir="rtl">${ref('left', 'center')}</div>`, el: `<div dir="rtl">${el('left', 'center')}</div>` },
    { id: 'side-offset', wrap: W(), ref: ref('bottom', 'center'), el: el('bottom', 'center', { attrs: 'side-offset="4"' }) },
    { id: 'long-content', wrap: W(), ref: ref('bottom', 'center', { content: 'Set the dimensions for the layer, and keep going for long enough that the text wraps over several lines inside the panel.' }), el: el('bottom', 'center', { content: 'Set the dimensions for the layer, and keep going for long enough that the text wraps over several lines inside the panel.' }) },
];
export default { name: 'popover', items };
