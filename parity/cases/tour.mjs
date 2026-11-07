// shadcn-angular tour.component.html and .ts: a spotlight (a box-shadow that dims the page) and a card, both `fixed` there.
// Here they are `fixed` too, at the viewport coordinates the case box has once it is scrolled to the top, inside a clipping box:
// `clip-path` clips without becoming the containing block (the harness's `will-change: transform` would, so it is reset). Sides are always explicit: the automatic choice depends
// on where the case happens to sit in the viewport.
import { ref as buttonRef } from '../lib/button-ref.mjs';
// The harness scrolls a case to the top of the viewport before measuring (`scroll`), and the page has 16px of padding, so a case's
// own corner is at (16, 0) in the viewport; the last case gets room below it so it can scroll that far too.
const LEFT = 16;
const TOP = 0;
const BOX = 'will-change:auto;position:relative;width:420px;height:300px;box-sizing:border-box;padding:0;clip-path:inset(0);';
const CARD = 'fixed w-80 max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none';
const HIGHLIGHT = 'outline:2px solid var(--ring, #0ea5e9);outline-offset:4px;border-radius:6px;z-index:10001;';
const TARGET = (id, t, extra = '') => `<div id="${id}" style="position:absolute;left:${t.left}px;top:${t.top}px;width:${t.width}px;height:${t.height}px;display:flex;align-items:center;justify-content:center;background:var(--muted);border:1px solid var(--border);${extra}">Target</div>`;
const T = { left: 150, top: 40, width: 120, height: 36 };
const CARD_W = 320;
// Height of the card: border 2 + padding 32 + counter 16 + gap 4 + title 24 + actions (gap 16 + button 32), plus 4 + 20 per line of description.
const cardHeight = (lines) => 2 + 32 + 16 + 4 + 24 + 16 + 32 + (lines ? 4 + 20 * lines : 0);
const place = (side, t, h) => {
    const cx = t.left + t.width / 2;
    const cy = t.top + t.height / 2;
    if (side === 'bottom') return { top: t.top + t.height + 12, left: cx - CARD_W / 2 };
    if (side === 'top') return { top: t.top - h - 12, left: cx - CARD_W / 2 };
    if (side === 'right') return { top: cy - h / 2, left: t.left + t.width + 12 };
    return { top: cy - h / 2, left: t.left - CARD_W - 12 };
};
const BTN = { skip: ['ghost', 'sm'], previous: ['outline', 'sm'], next: ['default', 'sm'] };
const button = (kind, text) => buttonRef(BTN[kind][0], BTN[kind][1], text);
const refFor = ({ id, t = T, side = 'bottom', title = 'Welcome', description = 'This is where it starts.', lines = 1, position = '1 / 2', buttons = [['skip', 'Skip'], ['next', 'Next']], dir = '' }) => {
    const h = cardHeight(description ? lines : 0);
    const at = place(side, t, h);
    const spot = `<div class="fixed rounded-md pointer-events-none transition-all duration-150" style="top:${t.top - 6 + TOP}px;left:${t.left - 6 + LEFT}px;width:${t.width + 12}px;height:${t.height + 12}px;z-index:9999;box-shadow:0 0 0 9999px rgba(0,0,0,0.55);"></div>`;
    const card = `<div class="${CARD}" style="top:${at.top + TOP}px;left:${at.left + LEFT}px;z-index:10000;" tabindex="-1"${dir ? ` dir="${dir}"` : ''}><div class="text-xs text-muted-foreground mb-1">${position}</div><h3 class="font-semibold">${title}</h3>${description ? `<p class="text-sm text-muted-foreground mt-1">${description}</p>` : ''}<div class="flex flex-wrap items-center gap-2 mt-4 justify-end">${buttons.map(([k, text]) => button(k, text)).join('')}</div></div>`;
    return `${TARGET(id, t, HIGHLIGHT)}${spot}${card}`;
};
const step = (id, s = {}) => ({ target: `#${id}`, title: 'Welcome', description: 'This is where it starts.', ...s });
const elFor = ({ id, t = T, steps, attrs = '', goto }) =>
    `${TARGET(id, t)}<ge-tour ${attrs}${goto === undefined ? '' : ` data-goto="${goto}"`} data-props='${JSON.stringify({ steps, active: true })}'></ge-tour>`;
const item = (name, o) => ({ id: name, wrap: BOX + (name === 'hebrew' ? 'margin-bottom:900px;' : ''), at: 900, scroll: true, ref: refFor({ id: `t-${name}`, ...o.ref }), el: elFor({ id: `t-${name}`, steps: o.steps(`t-${name}`), attrs: o.attrs, goto: o.goto, t: o.ref?.t }) });
const two = (side) => (id) => [step(id, { side }), step(id, { title: 'Next one', side })];
const LONG = 'A longer explanation that has to wrap onto a few lines of the card, because it says more than fits on one line at this width.';

export default {
    name: 'tour',
    isolated: true,
    items: [
        item('bottom', { ref: { side: 'bottom' }, steps: two('bottom') }),
        item('top', { ref: { side: 'top', t: { left: 150, top: 170, width: 120, height: 36 } }, steps: two('top') }),
        item('right', { ref: { side: 'right', t: { left: 10, top: 130, width: 70, height: 36 } }, steps: two('right') }),
        item('left', { ref: { side: 'left', t: { left: 340, top: 130, width: 60, height: 36 } }, steps: two('left') }),
        item('middle', { ref: { title: 'Next one', position: '2 / 3', buttons: [['skip', 'Skip'], ['previous', 'Previous'], ['next', 'Next']] }, steps: (id) => [step(id), step(id, { title: 'Next one' }), step(id, { title: 'Third' })], goto: 1 }),
        item('last', { ref: { title: 'Next one', position: '2 / 2', buttons: [['previous', 'Previous'], ['next', 'Done']] }, steps: two('bottom'), goto: 1 }),
        item('only-step', { ref: { position: '1 / 1', buttons: [['next', 'Done']] }, steps: (id) => [step(id)] }),
        item('no-description', { ref: { description: '' }, steps: (id) => [step(id, { description: undefined }), step(id)] }),
        item('long-description', { ref: { description: LONG, lines: 3 }, steps: (id) => [step(id, { description: LONG }), step(id)] }),
        item('hide-skip', { ref: { buttons: [['next', 'Next']] }, attrs: 'show-skip="false"', steps: two('bottom') }),
        item('custom-labels', { ref: { buttons: [['skip', 'Leave'], ['next', 'Go on']] }, attrs: 'next-label="Go on" skip-label="Leave"', steps: two('bottom') }),
        item('hebrew', { ref: { dir: 'rtl', buttons: [['skip', 'דלג'], ['next', 'הבא']] }, attrs: 'locale="he"', steps: two('bottom') }),
    ],
};
