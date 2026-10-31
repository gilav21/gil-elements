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
    ]),
};
