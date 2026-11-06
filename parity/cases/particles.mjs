// shadcn-angular particles.component.ts: an absolutely positioned layer over its parent holding one absolutely positioned,
// click-through canvas. The dots are random and animated, so the cases compare the layer and canvas geometry with the field empty.
const canvas = '<canvas style="position:absolute;inset:0;pointer-events:none;width:100%;height:100%" width="240" height="120"></canvas>';
const host = (style = '') => `<ui-particles data-slot="particles" style="position:absolute;inset:0;display:block;${style}">${canvas}</ui-particles>`;
const box = (inner, style = '') => `<div style="position:relative;width:240px;height:120px;background:var(--muted);${style}">${inner}</div>`;

export default {
    name: 'particles',
    items: [
        { id: 'fills-parent', ref: box(host('pointer-events:auto')), el: box('<ge-particles count="0"></ge-particles>') },
        { id: 'mouse-interaction-off', ref: box(host(), 'outline:1px solid var(--border)'), el: box('<ge-particles count="0" mouse-interaction="false"></ge-particles>', 'outline:1px solid var(--border)') },
        { id: 'inset-parent', ref: box(host('pointer-events:auto'), 'width:200px;height:80px;border:4px solid var(--border)'), el: box('<ge-particles count="0"></ge-particles>', 'width:200px;height:80px;border:4px solid var(--border)') },
    ],
};
