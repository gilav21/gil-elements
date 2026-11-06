// shadcn-angular word-rotate.component.html: a relative inline-block overflow-hidden wrapper; every word is absolute inset-0, centred, with a
// 300ms transition; the active one at rest, the one before it parked above and the rest below, both invisible. The timer cannot be frozen,
// so the element side sets `current` directly (a 100000s duration keeps the timer out of the way) and the harness lets the transition finish.
const WORDS = ['Design', 'Build', 'Ship'];
const WORD = 'absolute inset-0 flex items-center justify-center transition-all duration-300';
const wordRef = (index, current, count) => {
    const state = index === current ? 'translate-y-0 opacity-100' : index === (current - 1 + count) % count ? '-translate-y-full opacity-0' : 'translate-y-full opacity-0';
    return `<span class="${WORD} ${state}">${WORDS[index]}</span>`;
};
const ref = (words, current, cls = 'w-32 h-8') => {
    const spans = words.map((w, i) => `<span class="${WORD} ${i === current ? 'translate-y-0 opacity-100' : i === (current - 1 + words.length) % words.length ? '-translate-y-full opacity-0' : 'translate-y-full opacity-0'}">${w}</span>`).join('');
    return `<ui-word-rotate class="contents"><span class="relative inline-block overflow-hidden ${cls}" data-slot="word-rotate">${spans}</span></ui-word-rotate>`;
};
const el = (words, current, style = 'width:8rem;height:2rem;') => `<ge-word-rotate duration="100000000" style="${style}" data-props='${JSON.stringify({ words, current })}'></ge-word-rotate>`;
const W = 'font-size:20px;font-weight:600;width:300px;';
export default {
    name: 'word-rotate',
    items: [
        { id: 'first', wrap: W, at: 900, ref: ref(WORDS, 0), el: el(WORDS, 0) },
        { id: 'second', wrap: W, at: 900, ref: ref(WORDS, 1), el: el(WORDS, 1) },
        { id: 'last', wrap: W, at: 900, ref: ref(WORDS, 2), el: el(WORDS, 2) },
        { id: 'two-words', wrap: W, at: 900, ref: ref(['Yes', 'No'], 1), el: el(['Yes', 'No'], 1) },
        { id: 'one-word', wrap: W, at: 900, ref: ref(['Alone'], 0), el: el(['Alone'], 0) },
        { id: 'no-words', wrap: `${W}outline:1px dashed var(--border);`, at: 900, ref: ref([], 0), el: el([], 0) },
        { id: 'taller-box', wrap: W, at: 900, ref: ref(WORDS, 1, 'w-40 h-14 border rounded-md'), el: el(WORDS, 1, 'width:10rem;height:3.5rem;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);') },
        { id: 'in-a-sentence', wrap: 'font-size:18px;width:360px;', at: 900, ref: `We ${ref(WORDS, 1, 'w-20 h-7 align-bottom')} products.`, el: `We ${el(WORDS, 1, 'width:5rem;height:1.75rem;vertical-align:bottom;')} products.` },
    ],
};
