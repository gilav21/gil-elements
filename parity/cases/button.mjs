// shadcn-angular button.component.ts (buttonVariants) and .html. The class strings are what
// class-variance-authority plus tailwind-merge produce: where a variant or size repeats a base
// utility of the same kind (rounded, text size, border or ring colour) the later one replaces it.
import { VARIANT, ref } from '../lib/button-ref.mjs';
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5v14"/></svg>';
const SPIN = '<div class="absolute inset-0 flex items-center justify-center" aria-hidden="true"><output class="inline-flex" aria-label="Loading"><svg class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></output></div>';

const items = [];
const ICON_SIZES = ['icon', 'icon-sm', 'icon-lg'];
const el = (variant, size, content) =>
    `<ge-button${variant === 'default' ? '' : ` variant="${variant}"`}${size === 'default' ? '' : ` size="${size}"`}>${content}</ge-button>`;
// Every variant at every size: a size can change a variant's corners, border or text size, so the pairs are the unit.
for (const variant of Object.keys(VARIANT)) {
    for (const size of ['default', 'sm', 'lg', ...ICON_SIZES]) {
        const content = ICON_SIZES.includes(size) ? ICON : 'Save changes';
        items.push({ id: `${variant}-${size}`, ref: ref(variant, size, content), el: el(variant, size, content) });
    }
}
// States that repaint a variant (opacity, overlay spinner) rather than only a default-variant button.
for (const variant of Object.keys(VARIANT)) {
    items.push(
        { id: `${variant}-disabled`, ref: ref(variant, 'default', 'Save changes', { disabled: true }), el: `<ge-button${variant === 'default' ? '' : ` variant="${variant}"`} disabled>Save changes</ge-button>` },
        { id: `${variant}-loading`, at: 700, ref: ref(variant, 'default', `${SPIN}Save changes`, { extra: 'relative', disabled: true }), el: `<ge-button${variant === 'default' ? '' : ` variant="${variant}"`} loading>Save changes</ge-button>` },
    );
}
items.push(
    { id: 'label-attribute', ref: ref('secondary', 'default', 'Save changes'), el: '<ge-button variant="secondary" label="Save changes"></ge-button>' },
    { id: 'skeleton', at: 700, ref: '<ui-button class="contents"><div class="bg-primary/10 animate-pulse rounded-md h-9 w-24"></div></ui-button>', el: '<ge-button skeleton></ge-button>' },
    { id: 'density-0.75', wrap: '--density:0.75;', ref: ref('default', 'default', 'Save changes'), el: '<ge-button>Save changes</ge-button>' },
    { id: 'density-1.25-lg', wrap: '--density:1.25;', ref: ref('outline', 'lg', 'Save changes'), el: '<ge-button variant="outline" size="lg">Save changes</ge-button>' },
);
export default { name: 'button', items };
