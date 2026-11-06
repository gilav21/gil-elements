// shadcn-angular wobble-card.component: the host carries `relative overflow-hidden rounded-xl transition-transform duration-200 ease-out` and an inline
// perspective/rotate transform; at rest it is perspective(1000px) rotateX(0deg) rotateY(0deg). Angular's host is an inline custom element, where
// overflow, radius and transform do nothing, so the reference adds `block` (the gap is reported on shadcn-angular).
const CARD = 'bg-card text-card-foreground border p-6 h-24';
const ref = (cls = '', perspective = 1000, round = 'rounded-xl') => `<ui-wobble-card class="relative overflow-hidden ${round} transition-transform duration-200 ease-out block ${CARD} ${cls}" data-slot="wobble-card" style="transform:perspective(${perspective}px) rotateX(0deg) rotateY(0deg)">Hover me</ui-wobble-card>`;
const el = (extra = '', more = '') => `<ge-wobble-card ${extra} style="${more}background:var(--card);color:var(--card-foreground);border:1px solid var(--border);padding:1.5rem;height:6rem;box-sizing:border-box">Hover me</ge-wobble-card>`;
export default {
    name: 'wobble-card',
    items: [
        { id: 'default', wrap: 'width:280px;', ref: ref(), el: el() },
        { id: 'perspective', wrap: 'width:280px;', ref: ref('', 400), el: el('perspective="400"') },
        { id: 'square-corners', wrap: 'width:280px;', ref: ref('', 1000, 'rounded-none'), el: el('', 'border-radius:0;') },
    ],
};
