// shadcn-angular signature-pad.component: a clipped box (rounded-lg border, ring on focus-within) holding a block canvas of the given height and,
// below a border-t (Angular's `p-2` utility beats the component's density padding in `@layer components`, so the Density slider never reaches it;
// the reference omits `p-2` to show the intended result, reported on shadcn-angular), a right-aligned row of ghost sm Undo and Clear buttons (both disabled while blank).
import { ref as button } from '../lib/button-ref.mjs';

const BASE = 'relative w-full overflow-hidden border-input bg-transparent transition-colors focus-within:border-ring aria-disabled:pointer-events-none aria-disabled:opacity-50';
const WRAP = {
    outline: `${BASE} focus-within:ring-ring/50 focus-within:ring-[3px] dark:bg-input/30 rounded-lg border`,
    underline: `${BASE} rounded-none border-b border-x-0 border-t-0 shadow-none focus-within:ring-0`,
    ghost: `${BASE} border-none shadow-none focus-within:ring-0`,
};
const ref = ({ variant = 'outline', height = 180, disabled = false, controls = true } = {}) =>
    `<ui-signature-pad class="contents"><div class="${WRAP[variant]}" data-slot="signature-pad" data-variant="${variant}" ${disabled ? 'aria-disabled="true"' : ''}>`
    + `<canvas tabindex="0" class="block w-full touch-none outline-none" style="height:${height}px" data-slot="signature-pad-canvas" role="img" aria-label="Signature"></canvas>`
    + (controls
        ? `<div class="border-input flex flex-wrap justify-end gap-2 border-t">${button('ghost', 'sm', 'Undo', { disabled: true, host: 'data-slot="signature-pad-undo"' })}${button('ghost', 'sm', 'Clear', { disabled: true, host: 'data-slot="signature-pad-clear"' })}</div>`
        : '')
    + '</div></ui-signature-pad>';
const el = ({ variant, height, disabled = false, controls = true } = {}) =>
    `<ge-signature-pad${variant ? ` variant="${variant}"` : ''}${height ? ` height="${height}"` : ''}${disabled ? ' disabled' : ''}${controls ? '' : ' hide-controls'}></ge-signature-pad>`;
const W = 'width:20rem;';
export default {
    name: 'signature-pad',
    items: [
        { id: 'blank', wrap: W, ref: ref(), el: el() },
        ...['underline', 'ghost'].map((variant) => ({ id: variant, wrap: W, ref: ref({ variant }), el: el({ variant }) })),
        { id: 'short', wrap: W, ref: ref({ height: 100 }), el: el({ height: 100 }) },
        { id: 'disabled', wrap: W, ref: ref({ disabled: true }), el: el({ disabled: true }) },
        { id: 'no-controls', wrap: W, ref: ref({ controls: false }), el: el({ controls: false }) },
        { id: 'focus', wrap: W, focus: { ref: 'canvas', el: 'canvas' }, ref: ref(), el: el() },
        { id: 'density-1.5', wrap: `${W}--density:1.5;`, ref: ref(), el: el() },
    ],
};
