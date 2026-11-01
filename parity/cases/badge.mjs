// Class strings copied from shadcn-angular badge.component.ts (badgeVariants).
const BASE = 'inline-flex items-center rounded-md border text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';
const VARIANTS = {
    default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
    secondary: 'border-border bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive: 'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
    outline: 'text-foreground',
};
export default {
    name: 'badge',
    items: Object.entries(VARIANTS).flatMap(([variant, classes]) => [
        { id: variant, ref: `<ui-badge data-slot="badge" class="${BASE} ${classes}">Status</ui-badge>`, el: `<ge-badge variant="${variant}" label="Status"></ge-badge>` },
        { id: `${variant}-slotted`, ref: `<ui-badge data-slot="badge" class="${BASE} ${classes}">Status</ui-badge>`, el: `<ge-badge variant="${variant}">Status</ge-badge>` },
    ]).concat([
        // Angular drops every variant style while skeleton is set, whatever the variant.
        { id: 'skeleton', at: 700, ref: '<ui-badge data-slot="badge" class="inline-flex"><ui-skeleton class="rounded-md animate-pulse bg-primary/10 h-5 w-16"></ui-skeleton></ui-badge>', el: '<ge-badge skeleton variant="destructive" label="Status"></ge-badge>' },
    ]),
};
