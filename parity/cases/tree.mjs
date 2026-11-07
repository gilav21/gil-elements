// shadcn-angular tree.component.ts and sub/*.component.ts.
const CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
const FOCUS_BAR = 'after:absolute after:bottom-[1px] after:left-2 after:right-2 after:h-[1px] after:bg-border after:shadow-sm';

// A node is { k: key, l: label, i: icon, kids: [] }; the state says which keys are open, selected and focused.
const refItem = (n, st, rtl) => {
    const open = st.expand.includes(n.k);
    const kids = n.kids?.length > 0;
    const header = `flex items-center gap-1 rounded-md px-2 py-1 cursor-pointer transition-colors outline-none relative hover:bg-accent/50 hover:text-foreground${st.select.includes(n.k) ? ' bg-accent font-medium text-accent-foreground' : ''}${st.focus === n.k ? ` ${FOCUS_BAR}` : ''}`;
    const chevron = `h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200${open ? ' rotate-90' : ''}${rtl && !open ? ' rotate-180' : ''}`;
    const icon = n.i ? `<ui-tree-icon class="contents"><span class="me-2 h-4 w-4 shrink-0" data-slot="tree-icon" aria-hidden="true">${n.i}</span></ui-tree-icon>` : '';
    return `<ui-tree-item class="contents"><div class="select-none" data-slot="tree-item" role="treeitem"><div class="${header}" tabindex="0">${kids ? `<button type="button" class="${chevron}" aria-hidden="true" tabindex="-1">${CHEVRON}</button>` : '<span class="h-4 w-4 shrink-0"></span>'}<ui-tree-label class="contents"><span class="flex-1 truncate" data-slot="tree-label">${icon} ${n.l} </span></ui-tree-label></div>${kids ? `<div class="ps-4" role="group"${open ? '' : ' hidden'}>${n.kids.map((c) => refItem(c, st, rtl)).join('')}</div>` : ''}</div></ui-tree-item>`;
};
const ref = (nodes, st, rtl = false) => `<ui-tree class="block"><div class="text-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md" data-slot="tree" role="tree" tabindex="0">${nodes.map((n) => refItem(n, st, rtl)).join('')}</div></ui-tree>`;

const elItem = (n) => `<ge-tree-item value="${n.k}"><ge-tree-label>${n.i ? `<ge-tree-icon>${n.i}</ge-tree-icon> ` : ''}${n.l}</ge-tree-label>${(n.kids ?? []).map(elItem).join('')}</ge-tree-item>`;
const state = (st) => ` data-state='${JSON.stringify(st)}'`;
const el = (nodes, st, attrs = '') => `<ge-tree${attrs}${state(st)}>${nodes.map(elItem).join('')}</ge-tree>`;

const FILES = [
    { k: 'src', l: 'src', i: '📁', kids: [
        { k: 'app', l: 'app', i: '📁', kids: [{ k: 'main', l: 'main.ts', i: '📄' }, { k: 'routes', l: 'app.routes.ts', i: '📄' }] },
        { k: 'index', l: 'index.html', i: '📄' },
    ] },
    { k: 'readme', l: 'README.md', i: '📄' },
    { k: 'docs', l: 'docs', i: '📁', kids: [{ k: 'guide', l: 'guide.md', i: '📄' }] },
];
const PLAIN = [
    { k: 'a', l: 'Apple', kids: [{ k: 'a1', l: 'Fuji' }] },
    { k: 'b', l: 'Banana' },
    { k: 'c', l: 'Cherry' },
];
const NONE = { expand: [], select: [], focus: null };
const W = 'width:320px;';
const cases = [
    { id: 'collapsed', st: NONE, nodes: FILES },
    { id: 'expanded', st: { expand: ['src', 'app'], select: [], focus: null }, nodes: FILES },
    { id: 'plain-no-icons', st: { expand: ['a'], select: [], focus: null }, nodes: PLAIN },
    { id: 'selected', st: { expand: ['src'], select: ['index'], focus: null }, nodes: FILES, attrs: ' selectable="single"' },
    { id: 'selected-parent', st: { expand: ['src'], select: ['src'], focus: null }, nodes: FILES, attrs: ' selectable="single"' },
    { id: 'focused', st: { expand: ['src'], select: [], focus: 'app' }, nodes: FILES },
    { id: 'multiple-focused', st: { expand: ['src', 'app'], select: ['main', 'readme'], focus: 'routes' }, nodes: FILES, attrs: ' selectable="multiple"' },
];
const items = cases.map(({ id, st, nodes, attrs }) => ({ id, wrap: W, ref: ref(nodes, st), el: el(nodes, st, attrs) }));
items.push(
    { id: 'rtl', wrap: W, ref: `<div dir="rtl">${ref(FILES, { expand: ['src'], select: [], focus: null }, true)}</div>`, el: `<div dir="rtl">${el(FILES, { expand: ['src'], select: [], focus: null })}</div>` },
    { id: 'truncated', wrap: 'width:150px;', ref: ref([{ k: 'long', l: 'A very long file name that cannot fit.ts', i: '📄' }, ...PLAIN], NONE), el: el([{ k: 'long', l: 'A very long file name that cannot fit.ts', i: '📄' }, ...PLAIN], NONE) },
    { id: 'focused-tree', wrap: W, ref: ref(FILES, NONE), el: el(FILES, NONE), focus: { ref: "[role='tree']", el: 'ge-tree' } },
    {
        id: 'data-driven',
        wrap: W,
        ref: ref(FILES, { expand: ['src', 'app', 'docs'], select: [], focus: null }),
        el: `<ge-tree data-depth="-1" data-nodes='${JSON.stringify(FILES.map(function conv(n) { return { key: n.k, label: n.l, icon: n.i, children: n.kids?.map(conv) }; })).replaceAll("'", '&#39;')}'></ge-tree>`,
    },
);
export default { name: 'tree', isolated: false, items };
