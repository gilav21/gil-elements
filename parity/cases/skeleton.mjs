// shadcn-angular skeleton.component.ts: 'rounded-md' + 'animate-pulse bg-primary/10' | 'animate-shimmer'
const SIZE = 'h-5 w-16';
// `at` freezes the animations at that many ms; 800 puts the shimmer highlight inside the 64px box.
export default {
    name: 'skeleton',
    items: [
        { id: 'pulse', wrap: 'display:flex', ref: `<ui-skeleton class="rounded-md animate-pulse bg-primary/10 ${SIZE}"></ui-skeleton>`, el: '<ge-skeleton style="width:4rem;height:1.25rem"></ge-skeleton>' },
        { id: 'shimmer', at: 800, wrap: 'display:flex', ref: `<ui-skeleton class="rounded-md animate-shimmer ${SIZE}"></ui-skeleton>`, el: '<ge-skeleton variant="shimmer" style="width:4rem;height:1.25rem"></ge-skeleton>' },
        { id: 'pulse-wide', wrap: 'display:flex;width:200px', ref: '<ui-skeleton class="rounded-md animate-pulse bg-primary/10 h-4 w-full"></ui-skeleton>', el: '<ge-skeleton style="width:100%;height:1rem"></ge-skeleton>' },
    ],
};
