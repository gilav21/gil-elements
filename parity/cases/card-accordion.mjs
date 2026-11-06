// Angular defect (to file): the quick-form header button lacks min-w-0, so a long title never truncates and pushes the chevron off the card. The reference applies the fix.
// The card's classes are merged by cn(), so shadow-md replaces shadow-sm when open.
// shadcn-angular card-accordion.component.html, sub/card-accordion-{item,trigger,content,actions}.component.html
import { ref as buttonRef } from '../lib/button-ref.mjs';
const state = (open) => (open ? 'open' : 'closed');
const CHEVRON = (cls, extra = '') =>
    `<svg class="${cls}${extra}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>`;
const CARD = (open, inner) =>
    `<div class="overflow-hidden rounded-xl border bg-card text-card-foreground ${open ? 'shadow-md' : 'shadow-sm'} transition-shadow duration-200" data-slot="card-accordion-item" data-state="${state(open)}">${inner}</div>`;
const PANEL = (open, text, slot = 'card-accordion-content') =>
    `<div data-state="${state(open)}" data-slot="${slot}" class="grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}"><div class="overflow-hidden"><div class="text-sm text-muted-foreground transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}" data-slot="card-accordion-body"${open ? '' : ' inert=""'}>${text}</div></div></div>`;
const quickItem = ({ label, description, text }, open) =>
    `<ui-card-accordion-item class="contents">${CARD(
        open,
        `<h3 class="flex"><button type="button" class="flex min-w-0 flex-1 items-center justify-between gap-3 text-start transition-colors hover:bg-accent/40" aria-expanded="${open}" data-state="${state(open)}" data-slot="card-accordion-trigger"><span class="flex min-w-0 flex-col gap-1"><span class="truncate text-base font-semibold leading-snug">${label}</span>${description ? `<span class="text-sm font-normal text-muted-foreground">${description}</span>` : ''}</span>${CHEVRON('h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300', open ? ' rotate-180' : '')}</button></h3>${PANEL(open, text)}`,
    )}</ui-card-accordion-item>`;
const customItem = ({ label, text, actions }, open) =>
    `<ui-card-accordion-item class="contents">${CARD(
        open,
        `<ui-card-accordion-trigger class="contents"><div class="flex items-center gap-1"><button type="button" class="flex min-w-0 flex-1 items-center rounded-md text-start text-base font-semibold transition-colors" aria-expanded="${open}" data-state="${state(open)}" data-slot="card-accordion-trigger"><span class="min-w-0 flex-1 truncate">${label}</span></button>${actions ? `<ui-card-accordion-actions class="flex shrink-0 items-center gap-1" data-slot="card-accordion-actions">${actions}</ui-card-accordion-actions>` : ''}<button type="button" tabindex="-1" aria-hidden="true" class="flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground" data-slot="card-accordion-chevron">${CHEVRON('h-5 w-5 shrink-0 transition-transform duration-300', open ? ' rotate-180' : '')}</button></div></ui-card-accordion-trigger><ui-card-accordion-content class="contents">${PANEL(open, text)}</ui-card-accordion-content>`,
    )}</ui-card-accordion-item>`;
const skeletonItem = () =>
    `<ui-card-accordion-item class="contents">${CARD(false, '<div class="flex items-center justify-between gap-3 p-4 sm:p-6"><div class="flex flex-col gap-2"><ui-skeleton class="h-5 w-40 rounded-md animate-pulse bg-primary/10"></ui-skeleton><ui-skeleton class="h-4 w-56 rounded-md animate-pulse bg-primary/10"></ui-skeleton></div><ui-skeleton class="h-5 w-5 shrink-0 rounded-md animate-pulse bg-primary/10"></ui-skeleton></div>')}</ui-card-accordion-item>`;
const wrapRef = (inner) => `<ui-card-accordion class="contents"><div class="flex w-full flex-col" data-slot="card-accordion">${inner}</div></ui-card-accordion>`;

const DATA = [
    { label: 'Billing', description: 'Invoices and plans', text: 'Your next invoice is due in May.' },
    { label: 'Security', description: '', text: 'Two-factor authentication is on.' },
    { label: 'Notifications', description: 'Email and push', text: 'You get a weekly digest.' },
];
const WIDTH = 'display:block;width:360px;';
const elQuick = (attrs) =>
    `<ge-card-accordion${attrs}>${DATA.map((d, i) => `<ge-card-accordion-item value="v${i}" heading="${d.label}"${d.description ? ` description="${d.description}"` : ''} content="${d.text}"></ge-card-accordion-item>`).join('')}</ge-card-accordion>`;
const customData = DATA.map((d, i) => ({ ...d, actions: i === 0 ? buttonRef('outline', 'sm', 'Retry') : '' }));
const elCustom = (attrs) =>
    `<ge-card-accordion${attrs}>${customData.map((d, i) => `<ge-card-accordion-item value="v${i}"><ge-card-accordion-trigger>${d.label}${d.actions ? `<ge-card-accordion-actions><ge-button variant="outline" size="sm">Retry</ge-button></ge-card-accordion-actions>` : ''}</ge-card-accordion-trigger><ge-card-accordion-content>${d.text}</ge-card-accordion-content></ge-card-accordion-item>`).join('')}</ge-card-accordion>`;
const quick = (open) => DATA.map((d, i) => quickItem(d, open.includes(i))).join('');
const custom = (open) => customData.map((d, i) => customItem(d, open.includes(i))).join('');
const open = (...idx) => ` value="${idx.map((i) => `v${i}`).join(',')}"`;
const long = { label: 'A card title far too long to fit on one line of this narrow card', description: 'Short note', text: 'Body.' };

export default {
    name: 'card-accordion',
    items: [
        { id: 'quick-closed', wrap: WIDTH, ref: wrapRef(quick([])), el: elQuick('') },
        { id: 'quick-first-open', wrap: WIDTH, ref: wrapRef(quick([0])), el: elQuick(open(0)) },
        { id: 'quick-several-open', wrap: WIDTH, ref: wrapRef(quick([0, 2])), el: elQuick(` type="multiple"${open(0, 2)}`) },
        { id: 'custom-first-open', wrap: WIDTH, ref: wrapRef(custom([0])), el: elCustom(open(0)) },
        { id: 'custom-closed', wrap: WIDTH, ref: wrapRef(custom([])), el: elCustom('') },
        { id: 'skeleton', wrap: WIDTH, ref: wrapRef(skeletonItem()), el: '<ge-card-accordion><ge-card-accordion-item value="s" skeleton></ge-card-accordion-item></ge-card-accordion>' },
        { id: 'long-title', wrap: 'display:block;width:240px;', ref: wrapRef(quickItem(long, false)), el: `<ge-card-accordion><ge-card-accordion-item value="l" heading="${long.label}" description="${long.description}" content="${long.text}"></ge-card-accordion-item></ge-card-accordion>` },
        { id: 'focus', wrap: WIDTH, focus: { ref: 'ui-card-accordion-item:nth-child(2) button', el: 'ge-card-accordion-item:nth-child(2) button' }, ref: wrapRef(quick([0])), el: elQuick(open(0)) },
        { id: 'rtl', wrap: WIDTH, ref: `<div dir="rtl">${wrapRef(custom([0]))}</div>`, el: `<div dir="rtl">${elCustom(open(0))}</div>` },
        { id: 'density-1.5', wrap: `${WIDTH}--density:1.5;`, ref: wrapRef(quick([0])), el: elQuick(open(0)) },
        { id: 'custom-density-0.75', wrap: `${WIDTH}--density:0.75;`, ref: wrapRef(custom([0])), el: elCustom(open(0)) },
    ],
};
