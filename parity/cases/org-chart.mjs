import { colorLib, utils } from '../lib/chart-libs.mjs';
import { SAMPLE_IMAGE } from '../lib/sample-image.mjs';
// shadcn-angular org-chart.component.ts and .html: the layout is the component's own algorithm, transcribed.
const n = (id, name, parentId, extra = {}) => ({ id, name, ...(parentId === undefined ? {} : { parentId }), ...extra });
const TEAM = [
    n('ceo', 'Ada Lovelace', null, { title: 'Chief Executive' }),
    n('cto', 'Grace Hopper', 'ceo', { title: 'CTO', description: 'Owns engineering, platform and the long-term technical roadmap for every product line.' }),
    n('cfo', 'Alan Turing', 'ceo', { title: 'CFO' }),
    n('dev1', 'Linus T', 'cto', { title: 'Staff Engineer', color: '#ef4444' }),
    n('dev2', 'Margaret Hamilton-Smith', 'cto', { title: 'Principal Engineer with a very long title that cannot fit' }),
    n('acc', 'Dana', 'cfo'),
];
const WITH_IMAGE = [n('a', 'Pictured Person', null, { title: 'Lead', image: SAMPLE_IMAGE }), n('b', 'No Picture', 'a', { title: 'Member' })];
const FOREST = [n('r1', 'First Root', null, { title: 'Alpha' }), n('c1', 'Child One', 'r1'), n('r2', 'Second Root', null, { title: 'Beta' }), n('c2', 'Child Two', 'r2'), n('c3', 'Child Three', 'r2')];
const DANGLING = [n('root', 'Root', null), n('kid', 'Kid', 'root'), n('lost', 'Lost', 'nobody'), n('loop-a', 'Loop A', 'loop-b'), n('loop-b', 'Loop B', 'loop-a')];

const ref = ({ data = TEAM, layout = 'vertical', w = 180, h = 80, px = 40, py = 60, images = true, line = 'curved', title, hover = null } = {}) => {
    const vertical = layout === 'vertical';
    const kids = new Map(data.map((d) => [d.id, []]));
    const roots = [];
    for (const d of data) {
        if (d.parentId === null || d.parentId === undefined) roots.push(d);
        else (kids.get(d.parentId) ?? kids.set(d.parentId, []).get(d.parentId)).push(d);
    }
    const build = (node, level) => ({ node, x: 0, y: 0, level, children: (kids.get(node.id) ?? []).map((c) => build(c, level + 1)) });
    const across = (t) => (t.children.length === 0 ? (vertical ? w : h) : t.children.reduce((s, c) => s + across(c), 0) + (t.children.length - 1) * (vertical ? px : py));
    const place = (t, sx, sy) => {
        const size = across(t);
        if (vertical) {
            t.x = sx + (size - w) / 2;
            t.y = sy;
            let cx = sx;
            for (const c of t.children) { place(c, cx, sy + h + py); cx += across(c) + px; }
        } else {
            t.x = sx;
            t.y = sy + (size - h) / 2;
            let cy = sy;
            for (const c of t.children) { place(c, sx + w + px, cy); cy += across(c) + py; }
        }
    };
    const reach = (t) => t.children.reduce((m, c) => ({ x: Math.max(m.x, reach(c).x), y: Math.max(m.y, reach(c).y) }), { x: t.x + w, y: t.y + h });
    let ox = 0;
    let oy = 0;
    const trees = [];
    for (const r of roots) {
        const t = build(r, 0);
        place(t, ox, oy);
        trees.push(t);
        if (vertical) ox = reach(t).x + px;
        else oy = reach(t).y + py;
    }
    const flat = [];
    const flatten = (t) => { flat.push(t); t.children.forEach(flatten); };
    trees.forEach(flatten);
    const paths = [];
    const connect = (t) => {
        for (const c of t.children) {
            let d;
            if (vertical) {
                const sx = t.x + w / 2; const sy = t.y + h; const ex = c.x + w / 2; const ey = c.y; const my = (sy + ey) / 2;
                d = line === 'curved' ? `M ${sx} ${sy} C ${sx} ${my}, ${ex} ${my}, ${ex} ${ey}` : `M ${sx} ${sy} L ${sx} ${my} L ${ex} ${my} L ${ex} ${ey}`;
            } else {
                const sx = t.x + w; const sy = t.y + h / 2; const ex = c.x; const ey = c.y + h / 2; const mx = (sx + ex) / 2;
                d = line === 'curved' ? `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}` : `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ey} L ${ex} ${ey}`;
            }
            paths.push(d);
            connect(c);
        }
    };
    trees.forEach(connect);
    const W = flat.length === 0 ? 400 : Math.max(...flat.map((t) => t.x + w)) + 20;
    const H = flat.length === 0 ? 300 : Math.max(...flat.map((t) => t.y + h)) + 20;
    const colorOf = (t) => t.node.color || utils.getChartColor(t.level);
    const initials = (name) => name.split(' ').map((s) => s[0]).join('').toUpperCase().slice(0, 2);
    const cards = flat.map((t, i) => {
        const nd = t.node;
        const dim = hover !== null && hover !== i;
        const color = colorOf(t);
        let avatar = '';
        if (images) avatar = nd.image ? `<img src="${nd.image}" alt="${nd.name}" class="w-10 h-10 rounded-full object-cover shrink-0"/>` : `<div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0" style="background-color:${color};color:${colorLib.readableForeground(color)}">${initials(nd.name)}</div>`;
        const label = nd.title ? `${nd.name}, ${nd.title}` : nd.name;
        return `<foreignObject x="${t.x}" y="${t.y}" width="${w}" height="${h}"><button type="button" xmlns="http://www.w3.org/1999/xhtml" class="w-full h-full p-3 rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer hover:shadow-md transition-shadow flex flex-col justify-center overflow-hidden text-left${dim ? ' opacity-50' : ''}" style="border-left-color:${color};border-left-width:4px" aria-label="${label}"><div class="flex items-center gap-3">${avatar}<div class="min-w-0 flex-1"><div class="font-semibold text-sm truncate">${nd.name}</div>${nd.title ? `<div class="text-xs text-muted-foreground truncate">${nd.title}</div>` : ''}</div></div>${nd.description ? `<div class="text-xs text-muted-foreground mt-2 line-clamp-2">${nd.description}</div>` : ''}</button></foreignObject>`;
    }).join('');
    const summary = `Organization chart with ${flat.length} members`;
    return `<ui-org-chart class="block"><div class="relative block w-full max-w-full" data-slot="org-chart"><svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" style="max-width:${W}px;aspect-ratio:${W} / ${H}" class="overflow-visible" role="group" aria-label="${title ? `${title}: ${summary}` : summary}"><g class="org-chart-lines">${paths.map((d) => `<path d="${d}" fill="none" stroke="currentColor" class="text-border" stroke-width="2"/>`).join('')}</g><g class="org-chart-nodes">${cards}</g></svg></div></ui-org-chart>`;
};

const el = ({ data = TEAM, layout = 'vertical', w = 180, h = 80, px = 40, py = 60, images = true, line = 'curved', title, hover = null } = {}) => {
    const attrs = [layout === 'vertical' ? '' : `layout="${layout}"`, w === 180 ? '' : `node-width="${w}"`, h === 80 ? '' : `node-height="${h}"`, px === 40 ? '' : `node-padding-x="${px}"`, py === 60 ? '' : `node-padding-y="${py}"`, images ? '' : 'hide-images', line === 'curved' ? '' : `line-type="${line}"`, title ? `heading="${title}"` : '', hover === null ? '' : `data-enter=".card,${hover}"`].filter(Boolean).join(' ');
    return `<ge-org-chart ${attrs} data-props='${JSON.stringify({ data })}'></ge-org-chart>`;
};
const pair = (id, opts = {}) => ({ id, wrap: 'width:700px;', ref: ref(opts), el: el(opts) });

export default {
    name: 'org-chart',
    items: [
        pair('vertical'),
        pair('horizontal', { layout: 'horizontal' }),
        pair('straight-lines', { line: 'straight' }),
        pair('horizontal-straight', { layout: 'horizontal', line: 'straight' }),
        pair('no-images', { images: false }),
        pair('photo-and-initials', { data: WITH_IMAGE }),
        pair('several-roots', { data: FOREST }),
        pair('several-roots-horizontal', { data: FOREST, layout: 'horizontal' }),
        pair('dangling-and-cyclic-links-dropped', { data: DANGLING }),
        pair('empty', { data: [] }),
        pair('custom-size-and-gaps', { w: 150, h: 100, px: 16, py: 30 }),
        pair('titled', { title: 'Leadership' }),
        pair('hover-card', { hover: 1 }),
        pair('hover-root', { hover: 0, data: WITH_IMAGE }),
    ],
};
