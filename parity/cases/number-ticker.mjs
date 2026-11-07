// shadcn-angular number-ticker: an inline-block tabular-nums tracking-wider span of ui-number-ticker-digit cells, each a
// relative inline-block overflow-hidden 1em x 0.6em box. A digit holds a column of two 1em rows (previous, current); a
// separator holds one row. The reference is the settled DOM, with the text colour as `text-foreground`: Angular hard-codes
// black/white, which the Lit element deliberately does not.
const ROW = 'h-[1em] flex items-center justify-center';
const cell = (c) => `<ui-number-ticker-digit><div class="relative inline-block overflow-hidden h-[1em] w-[0.6em] align-top">${/\d/.test(c) ? `<div data-slot="number-ticker-digit-column" class="flex flex-col will-change-transform"><span class="${ROW}">${c}</span><span class="${ROW}">${c}</span></div>` : `<span class="${ROW}">${c}</span>`}</div></ui-number-ticker-digit>`;
const ref = (text, cls = '') => `<ui-number-ticker dir="ltr"><span class="inline-block tabular-nums tracking-wider text-foreground ${cls}" data-slot="number-ticker">${[...text].map(cell).join('')}</span></ui-number-ticker>`;
const el = (attrs) => `<ge-number-ticker duration="0.01" ${attrs}></ge-number-ticker>`;
const W = 'font-size:32px;';
export default {
    name: 'number-ticker',
    items: [
        { id: 'integer', wrap: W, at: 900, ref: ref('42'), el: el('value="42"') },
        { id: 'grouped', wrap: W, at: 900, ref: ref('1,234,567'), el: el('value="1234567"') },
        { id: 'decimals', wrap: W, at: 900, ref: ref('3.14'), el: el('value="3.14159" decimal-places="2"') },
        { id: 'zero', wrap: W, at: 900, ref: ref('0'), el: el('value="0"') },
        { id: 'negative', wrap: W, at: 900, ref: ref('-250'), el: el('value="-250"') },
        { id: 'locale-de', wrap: W, at: 900, ref: ref('1.234,5'), el: el('value="1234.5" decimal-places="1" locale="de"') },
        { id: 'small-text', wrap: 'font-size:14px;', at: 900, ref: ref('9,001'), el: el('value="9001"') },
    ],
};
