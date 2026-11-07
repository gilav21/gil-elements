// shadcn-angular morphing-text.component.html: a `relative inline-block` wrapper holding two absolutely centred layers (the current text
// sharp, the next blurred and invisible) and an `invisible` copy of the longest text that gives the box its size. The timer cannot be
// frozen, so every case uses an interval of a hundred million ms and shows the first text at rest.
const LAYER = 'absolute inset-0 flex items-center justify-center transition-all';
const ref = (texts, cls = '') => {
    const longest = texts.reduce((best, t) => (t.length > best.length ? t : best), '');
    const next = texts.length ? texts[1 % texts.length] : '';
    return `<ui-morphing-text class="contents"><span class="relative inline-block ${cls}" data-slot="morphing-text"><span class="${LAYER} opacity-100 blur-0" style="transition-duration:500ms">${texts[0] ?? ''}</span><span class="${LAYER} opacity-0 blur-sm" style="transition-duration:500ms">${next}</span><span class="invisible">${longest}</span></span></ui-morphing-text>`;
};
const el = (texts, style = '') => `<ge-morphing-text interval="100000000" style="${style}" data-props='${JSON.stringify({ texts })}'></ge-morphing-text>`;
const W = 'font-size:28px;font-weight:700;width:360px;';
const TEXTS = ['Design', 'Build', 'Ship it'];
export default {
    name: 'morphing-text',
    items: [
        { id: 'default', wrap: W, ref: ref(TEXTS), el: el(TEXTS) },
        { id: 'longest-first', wrap: W, ref: ref(['Short', 'A much longer line']), el: el(['Short', 'A much longer line']) },
        { id: 'one-text', wrap: W, ref: ref(['Alone']), el: el(['Alone']) },
        { id: 'no-texts', wrap: `${W}outline:1px dashed var(--border);`, ref: ref([]), el: el([]) },
        { id: 'in-a-sentence', wrap: 'font-size:18px;width:360px;', ref: `We ${ref(TEXTS)} products.`, el: `We ${el(TEXTS)} products.` },
        { id: 'coloured', wrap: W, ref: ref(TEXTS, 'text-primary'), el: el(TEXTS, 'color:var(--primary)') },
    ],
};
