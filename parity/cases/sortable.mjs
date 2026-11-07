// shadcn-angular sortable.component.html and sortable-item.component.ts: the list is a flex container and each row a
// flex box whose classes follow the drag state. The row's ring offset is white in dark mode in Angular (no ring-offset-background);
// the reference applies the proposed fix. Both rings also take the card's corners (rounded-md here, the host's own radius in ge-sortable) instead of Angular's fixed 4px. Pointer and keyboard behaviour is in sortable.browser.test.ts.
const ITEM = 'relative flex items-center gap-2 select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ring-offset-background rounded-md';
const DRAGGABLE = 'touch-none cursor-grab active:cursor-grabbing';
const LIFTED = 'ring-2 ring-primary ring-offset-1 rounded-md';
const CARD = 'rounded-md border bg-card px-3 py-2 text-sm text-card-foreground w-full';
const CARD_STYLE = 'box-sizing:border-box;width:100%;padding:0.5rem 0.75rem;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);background:var(--card);color:var(--card-foreground);font-size:0.875rem;line-height:1.25rem';
const GRIP = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-muted-foreground"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>';

const GRIP_GE = GRIP.replace('class="h-4 w-4 text-muted-foreground"', 'style="width:1rem;height:1rem;color:var(--muted-foreground)"');
const names = ['Write the spec', 'Review the pull request', 'Ship it'];
const row = (name, { draggable = true, disabled = false, lifted = false, handle = false } = {}) =>
    `<div class="${[ITEM, draggable && !disabled ? DRAGGABLE : '', lifted ? LIFTED : ''].filter(Boolean).join(' ')}" data-slot="sortable-item" ${disabled ? 'aria-disabled="true"' : 'tabindex="0"'} aria-roledescription="sortable">` +
    `${handle ? `<span class="touch-none">${GRIP}</span>` : ''}<div class="${CARD}">${name}</div></div>`;
const ref = (opts = {}, dir = 'flex-col') =>
    `<ui-sortable class="contents"><div class="flex ${dir} gap-0" data-slot="sortable">${names.map((n, i) => row(n, { ...opts, lifted: opts.lifted === i })).join('')}</div></ui-sortable>`;
const ge = (attrs = '', { handle = false, lift = -1, disabled = false } = {}) =>
    `<ge-sortable ${attrs}>${names
        .map(
            (n, i) =>
                `<ge-sortable-item ${i === lift ? 'data-lift' : ''}>${handle ? `<ge-sortable-handle>${GRIP_GE}</ge-sortable-handle>` : ''}<div style="${CARD_STYLE}">${n}</div></ge-sortable-item>`,
        )
        .join('')}</ge-sortable>`;
const W = 'width:18rem;';

export default {
    name: 'sortable',
    items: [
        { id: 'default', wrap: W, ref: ref(), el: ge() },
        { id: 'handle-only', wrap: W, ref: ref({ draggable: false, handle: true }), el: ge('handle-only', { handle: true }) },
        { id: 'disabled', wrap: W, ref: ref({ disabled: true }), el: ge('disabled') },
        { id: 'lifted', wrap: W, ref: ref({ lifted: 1 }), el: ge('', { lift: 1 }) },
        { id: 'focus', wrap: W, focus: { ref: "[data-slot='sortable-item']", el: 'ge-sortable-item' }, ref: ref(), el: ge() },
        { id: 'horizontal', wrap: 'width:40rem;', ref: ref({}, 'flex-row flex-wrap'), el: ge('orientation="horizontal"') },
    ],
};
