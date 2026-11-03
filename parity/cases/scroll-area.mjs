// shadcn-angular scroll-area.component.html; the consumer's `class` lands on the root, which is the host here.
const ROOT = 'relative overflow-hidden';
const VIEWPORT = 'size-full rounded-[inherit] overflow-auto scrollbar-none focus-visible:ring-ring/50 transition-[color,box-shadow] outline-none focus-visible:ring-[3px]';
const VBAR = 'absolute end-0 top-0 flex touch-none p-px transition-colors select-none h-full w-2.5 border-s border-s-transparent';
const HBAR = 'absolute bottom-0 left-0 flex touch-none p-px transition-colors select-none h-2.5 w-full flex-row border-t border-t-transparent';
const rows = (n, wide) => Array.from({ length: n }, (_, i) => `<div style="height:2rem;white-space:nowrap">${wide ? `Row ${i + 1} with a long line of text that runs past the right edge of the box` : `Row ${i + 1}`}</div>`).join('');
const content = (n, wide) => `<div style="${wide ? 'width:36rem' : ''}">${rows(n, wide)}</div>`;
const vThumb = (h, top) => `<div class="${VBAR}" data-slot="scroll-area-scrollbar" data-orientation="vertical"><div class="bg-border relative w-full rounded-full" data-slot="scroll-area-thumb" style="height:${h}%;top:${top}%"></div></div>`;
const hThumb = (w, left) => `<div class="${HBAR}" data-slot="scroll-area-scrollbar" data-orientation="horizontal"><div class="bg-border relative h-full rounded-full" data-slot="scroll-area-thumb" style="width:${w}%;left:${left}%"></div></div>`;
const root = (cls, body, bars = '') => `<ui-scroll-area class="contents"><div class="${ROOT} ${cls}" data-slot="scroll-area"><div class="${VIEWPORT}" data-slot="scroll-area-viewport" tabindex="0">${body}</div>${bars}</div></ui-scroll-area>`;
const BOX = 'h-40 w-48 rounded-lg border';
const eBox = 'height:10rem;width:12rem;border:1px solid var(--border);border-radius:var(--radius)';
// Thumb sizes follow the box: the viewport is 10rem - 2px border = 158px tall and 190px wide inside.
const el = (attrs, body) => `<ge-scroll-area ${attrs} style="${eBox}">${body}</ge-scroll-area>`;
export default {
    name: 'scroll-area',
    items: [
        { id: 'fits', ref: root(BOX, content(3, false)), el: el('', content(3, false)) },
        { id: 'vertical', ref: root(BOX, content(20, false), vThumb(158 / 640 * 100, 0)), el: el('', content(20, false)) },
        { id: 'vertical-ignores-width', ref: root(BOX, content(20, true), vThumb(158 / 640 * 100, 0)), el: el('', content(20, true)) },
        { id: 'both', ref: root(BOX, content(20, true), vThumb(158 / 640 * 100, 0) + hThumb(190 / 576 * 100, 0) + '<div class="absolute right-0 bottom-0 w-2.5 h-2.5 bg-transparent"></div>'), el: el('orientation="both"', content(20, true)) },
        { id: 'horizontal', ref: root(BOX, content(20, true), hThumb(190 / 576 * 100, 0)), el: el('orientation="horizontal"', content(20, true)) },
    ],
};
