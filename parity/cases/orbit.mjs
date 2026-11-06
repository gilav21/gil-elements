// shadcn-angular orbit.component: the host is `absolute inset-0 pointer-events-none` and spins with a Web Animation; its one child div sits
// at 50%/50%, shifted by translate(-50%, -50%) translateX(radius). A delay of a hundred thousand seconds keeps every case at 0deg.
const dot = '<span style="display:block;width:20px;height:20px;border-radius:9999px;background:var(--primary)"></span>';
const box = (inner) => `<div style="position:relative;width:240px;height:240px;border:1px solid var(--border);border-radius:var(--radius)">${inner}</div>`;
const ref = (radius, style = '') => `<ui-orbit class="absolute inset-0 pointer-events-none" data-slot="orbit"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%, -50%) translateX(${radius}px);pointer-events:auto;${style}">${dot}</div></ui-orbit>`;
const el = (radius, attrs = '') => `<ge-orbit radius="${radius}" delay="100000" ${attrs}>${dot}</ge-orbit>`;
export default {
    name: 'orbit',
    items: [
        { id: 'default-radius', ref: box(ref(100)), el: box(el(100)) },
        { id: 'small-radius', ref: box(ref(40)), el: box(el(40)) },
        { id: 'zero-radius', ref: box(ref(0)), el: box(el(0)) },
        { id: 'reverse', ref: box(ref(80)), el: box(el(80, 'reverse')) },
        { id: 'two-items', ref: box(`${ref(40)}${ref(90)}`), el: box(`${el(40)}${el(90)}`) },
    ],
};
