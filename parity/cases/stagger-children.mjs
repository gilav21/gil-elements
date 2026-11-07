// shadcn-angular stagger-children.component: a `block` host whose direct children fade and slide in one after another once the host is on
// screen, ending at full opacity in place. The cases wait for a one-millisecond animation and compare that end state.
const kids = '<div class="rounded-md border p-3 mb-2">One</div><div class="rounded-md border p-3 mb-2">Two</div><div class="rounded-md border p-3 mb-2">Three</div>';
const kidsEl = '<div style="border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);padding:.75rem;margin-bottom:.5rem">One</div><div style="border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);padding:.75rem;margin-bottom:.5rem">Two</div><div style="border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);padding:.75rem;margin-bottom:.5rem">Three</div>';
const ref = (cls = '') => `<ui-stagger-children class="block ${cls}" data-slot="stagger-children">${kids}</ui-stagger-children>`;
const el = (attrs = '', style = '') => `<ge-stagger-children duration="1" stagger-delay="0" ${attrs} style="${style}">${kidsEl}</ge-stagger-children>`;
const W = 'width:280px;';
export default {
    name: 'stagger-children',
    items: [
        { id: 'up', wrap: W, scroll: true, at: 700, ref: ref(), el: el() },
        { id: 'left', wrap: W, scroll: true, at: 700, ref: ref(), el: el('direction="left"') },
        { id: 'empty', wrap: `${W}outline:1px dashed var(--border);`, scroll: true, at: 700, ref: '<ui-stagger-children class="block" data-slot="stagger-children"></ui-stagger-children>', el: el().replace(kidsEl, '') },
    ],
};
