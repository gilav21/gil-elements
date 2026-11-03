// shadcn-angular banner.component.ts (bannerVariants) and .html
import { ref as button } from '../lib/button-ref.mjs';
const BASE = 'block w-full border-b px-4 py-3 text-sm sm:px-6';
const VARIANT = {
    info: 'border-border bg-muted text-foreground',
    warning: 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200',
    success: 'border-green-500/40 bg-green-500/10 text-green-900 dark:text-green-200',
    destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
};
const CLOSE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
const ref = (variant, body, dismissible) =>
    `<ui-banner class="${BASE} ${VARIANT[variant]}" role="${variant === 'destructive' ? 'alert' : 'status'}" data-variant="${variant}" data-slot="banner"><div class="mx-auto flex w-full max-w-[calc(100vw-2rem)] flex-wrap items-center gap-x-3 gap-y-2"><div class="min-w-0 flex-1 break-words" data-slot="banner-message">${body}</div>${dismissible ? button('ghost', 'icon-sm', CLOSE, { extra: '-me-2 shrink-0 pointer-coarse:size-11' }) : ''}</div></ui-banner>`;
const MSG = 'Scheduled maintenance on Saturday from 02:00 to 04:00 UTC.';
const LONG = 'Your trial ends in three days. Add a payment method to keep every project, teammate and integration you have set up working without interruption.';
const W = 'width:44rem;';
const items = ['info', 'warning', 'success', 'destructive'].map((v) => ({ id: v, wrap: W, ref: ref(v, MSG, false), el: `<ge-banner variant="${v}" message="${MSG}"></ge-banner>` }));
items.push(
    { id: 'dismissible', wrap: W, ref: ref('info', MSG, true), el: `<ge-banner message="${MSG}" dismissible></ge-banner>` },
    { id: 'dismissible-destructive', wrap: W, ref: ref('destructive', MSG, true), el: `<ge-banner variant="destructive" message="${MSG}" dismissible></ge-banner>` },
    { id: 'wraps-narrow', wrap: 'width:20rem;', ref: ref('warning', LONG, true), el: `<ge-banner variant="warning" message="${LONG}" dismissible></ge-banner>` },
    {
        id: 'custom-content',
        wrap: W,
        ref: ref('success', 'Version 2 is out. <a class="underline" href="#">Read the notes</a>', true),
        el: '<ge-banner variant="success" dismissible>Version 2 is out. <a href="#" style="color:inherit;text-decoration:underline">Read the notes</a></ge-banner>',
    },
    { id: 'rtl', wrap: `${W}direction:rtl;`, ref: ref('info', MSG, true), el: `<ge-banner message="${MSG}" dismissible></ge-banner>` },
);
export default { name: 'banner', items };
