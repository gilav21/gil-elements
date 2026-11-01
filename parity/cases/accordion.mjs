// shadcn-angular accordion.component.html, sub/accordion-item.component.html, sub/accordion-trigger.component.html, sub/accordion-content.component.html
const TRIGGER = 'flex flex-1 items-center justify-between text-sm font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180';
const CHEVRON = (open) =>
    `<svg class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>`;
const BODY = (text) => `<div class="pb-4 pt-0">${text}</div>`;
const state = (open) => (open ? 'open' : 'closed');
const button = (cls, label, open) =>
    `<h3 class="flex"><button type="button" class="${cls}" aria-expanded="${open}" data-state="${state(open)}" data-slot="accordion-trigger">${label}${CHEVRON(open)}</button></h3>`;

const customItem = ({ label, text }, open) =>
    `<ui-accordion-item class="contents"><div class="border-b" data-slot="accordion-item"><ui-accordion-trigger class="contents">${button(TRIGGER, label, open)}</ui-accordion-trigger><ui-accordion-content class="contents">${open ? `<div class="overflow-hidden text-sm" data-state="open" data-slot="accordion-content">${BODY(text)}</div>` : ''}</ui-accordion-content></div></ui-accordion-item>`;
// The real item template also puts `py-4` on this button, and that utility beats the density rule (shadcn-angular#221),
// so the density-1.5 reference drops it: py-4 at density 1 is the same 1rem the rule gives.
const quickItem = ({ label, text }, open) =>
    `<ui-accordion-item class="contents"><div class="border-b" data-slot="accordion-item">${button(TRIGGER, label, open)}${open ? `<div class="overflow-hidden text-sm" data-state="open" data-slot="accordion-content">${BODY(text)}</div>` : ''}</div></ui-accordion-item>`;
const skeletonItem = () =>
    '<ui-accordion-item class="contents"><div class="border-b" data-slot="accordion-item"><div class="flex items-center justify-between py-4"><ui-skeleton class="h-5 w-2/5 rounded-md animate-pulse bg-primary/10"></ui-skeleton><ui-skeleton class="h-4 w-4 shrink-0 rounded-md animate-pulse bg-primary/10"></ui-skeleton></div></div></ui-accordion-item>';
const wrapRef = (inner) => `<ui-accordion class="contents"><div class="w-full" data-slot="accordion">${inner}</div></ui-accordion>`;

const DATA = [
    { label: 'Is it accessible?', text: 'Yes. It adheres to the WAI-ARIA design pattern.' },
    { label: 'Is it styled?', text: 'Yes. It comes with default styles that match the other components.' },
    { label: 'Is it animated?', text: 'No, it simply shows and hides.' },
];
const WIDTH = 'display:block;width:360px;';
const custom = (open) => DATA.map((d, i) => customItem(d, open.includes(i))).join('');
const elCustom = (attrs) =>
    `<ge-accordion${attrs}>${DATA.map((d, i) => `<ge-accordion-item value="v${i}"><ge-accordion-trigger>${d.label}</ge-accordion-trigger><ge-accordion-content>${d.text}</ge-accordion-content></ge-accordion-item>`).join('')}</ge-accordion>`;
const elQuick = (attrs) => `<ge-accordion${attrs}>${DATA.map((d, i) => `<ge-accordion-item value="v${i}" heading="${d.label}" content="${d.text}"></ge-accordion-item>`).join('')}</ge-accordion>`;
const quick = (open) => DATA.map((d, i) => quickItem(d, open.includes(i))).join('');
const open = (...idx) => ` value="${idx.map((i) => `v${i}`).join(',')}"`;

const long = { label: 'A trigger whose label is long enough to wrap onto a second line', text: 'Body.' };
export default {
    name: 'accordion',
    items: [
        { id: 'custom-closed', wrap: WIDTH, ref: wrapRef(custom([])), el: elCustom('') },
        { id: 'custom-first-open', wrap: WIDTH, ref: wrapRef(custom([0])), el: elCustom(open(0)) },
        { id: 'custom-several-open', wrap: WIDTH, ref: wrapRef(custom([0, 2])), el: elCustom(` type="multiple"${open(0, 2)}`) },
        { id: 'quick-first-open', wrap: WIDTH, ref: wrapRef(quick([1])), el: elQuick(open(1)) },
        { id: 'quick-closed', wrap: WIDTH, ref: wrapRef(quick([])), el: elQuick('') },
        { id: 'skeleton', wrap: WIDTH, ref: wrapRef(skeletonItem()), el: '<ge-accordion><ge-accordion-item value="s" skeleton></ge-accordion-item></ge-accordion>' },
        { id: 'long-label', wrap: 'display:block;width:200px;', ref: wrapRef(customItem(long, false)), el: `<ge-accordion><ge-accordion-item value="l"><ge-accordion-trigger>${long.label}</ge-accordion-trigger><ge-accordion-content>${long.text}</ge-accordion-content></ge-accordion-item></ge-accordion>` },
        { id: 'focus', wrap: WIDTH, focus: { ref: 'ui-accordion-item:nth-child(2) button', el: 'ge-accordion-item:nth-child(2) ge-accordion-trigger' }, ref: wrapRef(custom([0])), el: elCustom(open(0)) },
        { id: 'rtl', wrap: WIDTH, ref: `<div dir="rtl">${wrapRef(custom([0]))}</div>`, el: `<div dir="rtl">${elCustom(open(0))}</div>` },
        { id: 'density-1.5', wrap: `${WIDTH}--density:1.5;`, ref: wrapRef(custom([0])), el: elCustom(open(0)) },
        { id: 'quick-density-1.5', wrap: `${WIDTH}--density:1.5;`, ref: wrapRef(quick([0])), el: elQuick(open(0)) },
    ],
};
