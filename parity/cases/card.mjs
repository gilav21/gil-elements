import { ref as buttonRef } from '../lib/button-ref.mjs';
// shadcn-angular card.component.ts and sub/*.ts: the class strings, copied; the host is a plain
// element carrying the same classes and data-slot, and unknown ui-* tags stand in for the
// component hosts so they keep the inline default display Angular's hosts have.
const SURFACE = 'bg-card text-card-foreground flex flex-col rounded-xl border shadow-sm';
const HEADER = '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6';
const FOOTER = 'flex items-center [.border-t]:pt-6';
const ACTION = 'col-start-2 row-span-2 row-start-1 self-start justify-self-end';
const SPIN = '<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';
const W = 'width:22rem;';

const parts = (extraHeader = '', extraFooter = '') => ({
    ref: `<div data-slot="card" class="${SURFACE}"><ui-card-header data-slot="card-header" class="${HEADER}${extraHeader}"><ui-card-title class="leading-none font-semibold">Create project</ui-card-title><ui-card-description class="text-muted-foreground text-sm">Deploy your new project in one click.</ui-card-description>${extraHeader ? `<div data-slot="card-action" class="${ACTION}">${buttonRef('outline', 'sm', 'Edit')}</div>` : ''}</ui-card-header><ui-card-content data-slot="card-content">Your name and framework go here.</ui-card-content><ui-card-footer data-slot="card-footer" class="${FOOTER}${extraFooter}">Cancel · Deploy</ui-card-footer></div>`,
});
const elParts = (bordered = false) =>
    `<ge-card><ge-card-header${bordered ? ' bordered' : ''}><ge-card-title>Create project</ge-card-title><ge-card-description>Deploy your new project in one click.</ge-card-description>${bordered ? '<div slot="action"><ge-button variant="outline" size="sm">Edit</ge-button></div>' : ''}</ge-card-header><ge-card-content>Your name and framework go here.</ge-card-content><ge-card-footer${bordered ? ' bordered' : ''}>Cancel · Deploy</ge-card-footer></ge-card>`;

const simpleRef = (overlay = '') =>
    `<div data-slot="card" class="${SURFACE}${overlay ? ' relative overflow-hidden' : ''}"><div class="${HEADER}" data-slot="card-header"><div class="leading-none font-semibold" data-slot="card-title">Notifications</div><div class="text-muted-foreground text-sm" data-slot="card-description">You have 3 unread messages.</div></div><div data-slot="card-content">Push everything to your phone.</div>${overlay}</div>`;

export default {
    name: 'card',
    items: [
        { id: 'custom', wrap: W, ref: parts().ref, el: elParts() },
        { id: 'custom-bordered-action', wrap: W, ref: parts(' border-b', ' border-t').ref, el: elParts(true) },
        { id: 'simple', wrap: W, ref: simpleRef(), el: '<ge-card heading="Notifications" description="You have 3 unread messages." content="Push everything to your phone."></ge-card>' },
        {
            id: 'simple-loading',
            wrap: W,
            ref: simpleRef(`<div class="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60"><output class="inline-flex" aria-label="Loading">${SPIN}</output></div>`),
            el: '<ge-card loading heading="Notifications" description="You have 3 unread messages." content="Push everything to your phone."></ge-card>',
            at: 700,
        },
        { id: 'skeleton', wrap: W, at: 700, ref: '<div class="block"><div class="bg-primary/10 animate-pulse rounded-xl h-40 w-full"></div></div>', el: '<ge-card skeleton></ge-card>' },
        { id: 'density-0.75', wrap: `${W}--density:0.75;`, ref: parts().ref, el: elParts() },
    ],
};
