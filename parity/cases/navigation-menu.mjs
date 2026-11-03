// shadcn-angular navigation-menu.component.html and sub/*.component.ts (+ their density css).
const TRIGGER = 'group inline-flex w-max shrink-0 items-center justify-center rounded-md bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 transition-colors';
const CHEVRON = (open) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="relative top-px ml-1 h-3 w-3 transition duration-200${open ? ' rotate-180' : ''}" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
const LINK = 'block select-none space-y-1 rounded-md leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground';
const PANEL = 'start-0 top-full mt-1.5 absolute min-w-[200px] max-w-[calc(100vw-2rem)] rounded-md border bg-popover text-popover-foreground shadow-lg';

const rLink = (inner, active = false) => `<ui-navigation-menu-link class="contents"><a class="${LINK}${active ? ' bg-accent/50' : ''}" data-slot="navigation-menu-link" href="#" role="menuitem">${inner}</a></ui-navigation-menu-link>`;
const rRows = `<div style="width:240px">${rLink('<div class="text-sm font-medium leading-none">Introduction</div><p class="line-clamp-2 text-sm leading-snug text-muted-foreground">Re-usable components built with Tailwind.</p>', true)}${rLink('<div class="text-sm font-medium leading-none">Installation</div>')}</div>`;
// cn() merges bg-background away when the item is open, so only bg-accent/50 reaches the browser.
const rTrigger = (label, open, panel) =>
    `<ui-navigation-menu-item class="contents"><li class="relative" data-slot="navigation-menu-item" role="none"><ui-navigation-menu-trigger class="contents"><button type="button" role="menuitem" class="${open ? TRIGGER.replace(' bg-background', '') + ' bg-accent/50' : TRIGGER}" data-slot="navigation-menu-trigger" aria-expanded="${open}" aria-haspopup="menu" data-state="${open ? 'open' : 'closed'}">${label}${CHEVRON(open)}</button></ui-navigation-menu-trigger><ui-navigation-menu-content class="contents">${open ? `<div class="${PANEL}" data-slot="navigation-menu-content" data-state="open" role="menu">${panel}</div>` : ''}</ui-navigation-menu-content></li></ui-navigation-menu-item>`;
const rLone = (label) => `<ui-navigation-menu-item class="contents"><li class="relative" data-slot="navigation-menu-item" role="none">${rLink(`<span class="text-sm font-medium">${label}</span>`)}</li></ui-navigation-menu-item>`;
const rMenu = (open, lone = true) =>
    `<ui-navigation-menu class="contents"><nav class="relative z-10 flex max-w-full sm:max-w-max flex-1 items-center justify-center" data-slot="navigation-menu" role="navigation"><ui-navigation-menu-list class="contents"><ul class="group flex flex-1 flex-wrap list-none items-center justify-center gap-1" data-slot="navigation-menu-list" role="menubar">${rTrigger('Getting started', open === 'a', rRows)}${rTrigger('Components', open === 'b', rLink('<div class="text-sm font-medium leading-none">Alert</div>'))}${lone ? rLone('Documentation') : ''}</ul></ui-navigation-menu-list></nav></ui-navigation-menu>`;

const eRows = `<div style="width:240px"><ge-navigation-menu-link active><div style="font-size:0.875rem;font-weight:500;line-height:1">Introduction</div><p style="margin:0;font-size:0.875rem;line-height:1.375;color:var(--muted-foreground)">Re-usable components built with Tailwind.</p></ge-navigation-menu-link><ge-navigation-menu-link><div style="font-size:0.875rem;font-weight:500;line-height:1">Installation</div></ge-navigation-menu-link></div>`;
const eMenu = (open, lone = true) =>
    `<ge-navigation-menu><ge-navigation-menu-list><ge-navigation-menu-item ${open === 'a' ? 'data-hover' : ''}><ge-navigation-menu-trigger>Getting started</ge-navigation-menu-trigger><ge-navigation-menu-content>${eRows}</ge-navigation-menu-content></ge-navigation-menu-item><ge-navigation-menu-item ${open === 'b' ? 'data-hover' : ''}><ge-navigation-menu-trigger>Components</ge-navigation-menu-trigger><ge-navigation-menu-content><ge-navigation-menu-link><div style="font-size:0.875rem;font-weight:500;line-height:1">Alert</div></ge-navigation-menu-link></ge-navigation-menu-content></ge-navigation-menu-item>${lone ? '<ge-navigation-menu-item><ge-navigation-menu-link><span style="font-size:0.875rem;line-height:1.25rem;font-weight:500">Documentation</span></ge-navigation-menu-link></ge-navigation-menu-item>' : ''}</ge-navigation-menu-list></ge-navigation-menu>`;

const ENTRIES = [
    { label: 'Home', href: '#home' },
    { label: 'Guides', children: [
        { title: 'Introduction', description: 'Re-usable components built with Tailwind CSS and a very long description that has to be clamped to two lines.', href: '#intro' },
        { title: 'Installation', href: '#install' },
    ] },
];
const rSimple = (open) => {
    const link = (c) => rLink(`<div class="text-sm font-medium leading-none">${c.title}</div>${c.description ? `<p class="line-clamp-2 text-sm leading-snug text-muted-foreground">${c.description}</p>` : ''}`);
    const grid = `<ul class="grid w-full sm:w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2">${ENTRIES[1].children.map((c) => `<li>${link(c)}</li>`).join('')}</ul>`;
    return `<ui-navigation-menu class="contents"><nav class="relative z-10 flex max-w-full sm:max-w-max flex-1 items-center justify-center" data-slot="navigation-menu" role="navigation"><ui-navigation-menu-list class="contents"><ul class="group flex flex-1 flex-wrap list-none items-center justify-center gap-1" data-slot="navigation-menu-list" role="menubar">${rLone('Home')}${rTrigger('Guides', open, grid)}</ul></ui-navigation-menu-list></nav></ui-navigation-menu>`;
};
const eSimple = (open) => `<ge-navigation-menu data-items='${JSON.stringify(ENTRIES)}' ${open ? 'data-open-index="0"' : ''}></ge-navigation-menu>`;

const W = (extra = '') => `width:560px;height:260px;box-sizing:content-box;${extra}`;
const rtl = (html) => `<div dir="rtl">${html}</div>`;
const items = [
    { id: 'closed', wrap: W(), ref: rMenu(''), el: eMenu('') },
    { id: 'open-a', wrap: W(), ref: rMenu('a'), el: eMenu('a') },
    { id: 'open-b', wrap: W(), ref: rMenu('b'), el: eMenu('b') },
    { id: 'density-1.5', wrap: W('--density:1.5;'), ref: rMenu('a'), el: eMenu('a') },
    { id: 'rtl-open', wrap: W(), ref: rtl(rMenu('a')), el: rtl(eMenu('a')) },
    { id: 'items-closed', wrap: W(), ref: rSimple(false), el: eSimple(false) },
    { id: 'items-open', wrap: W(), ref: rSimple(true), el: eSimple(true) },
];
export default { name: 'navigation-menu', isolated: true, items };
