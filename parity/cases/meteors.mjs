// shadcn-angular meteors.component: the host is `absolute`, inset 0, block, click-through, holding one absolutely placed, click-through canvas.
// The meteors are random and animated, so the cases compare the layer and canvas geometry with the sky empty.
const canvas = '<canvas style="position:absolute;inset:0;pointer-events:none;width:100%;height:100%" width="240" height="120"></canvas>';
const host = (style = '') => `<ui-meteors data-slot="meteors" style="position:absolute;inset:0;display:block;pointer-events:none;${style}">${canvas}</ui-meteors>`;
const box = (inner, style = '') => `<div style="position:relative;width:240px;height:120px;background:var(--muted);${style}">${inner}</div>`;
export default {
    name: 'meteors',
    items: [
        { id: 'fills-parent', ref: box(host()), el: box('<ge-meteors count="0"></ge-meteors>') },
        { id: 'inset-parent', ref: box(host(), 'width:200px;height:80px;border:4px solid var(--border)').replace('width="240" height="120"', 'width="200" height="80"'), el: box('<ge-meteors count="0"></ge-meteors>', 'width:200px;height:80px;border:4px solid var(--border)') },
    ],
};
