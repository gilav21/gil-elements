// shadcn-angular sidebar.component.ts, sidebar.service.ts and sub/*.component.ts. The page is 1000px wide: the
// sidebar is a drawer below 768px and a column above it.
const ICON = (d) => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const HOME = ICON('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>');
const MAIL = ICON('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 5L2 7"/>');
const FOLDER = ICON('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>');
const MORE = ICON('<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>');
const PANEL = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" x2="9" y1="3" y2="21"/></svg>';

const SR = '[&>span:not(:first-child)]:sr-only';
const ROW = 'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors';
const ACTIVE = 'bg-sidebar-accent text-sidebar-accent-foreground';
const COLLAPSED_ROW = `justify-center px-2 overflow-hidden ${SR} [&>svg]:shrink-0`;
// cn() runs tailwind-merge, so an active row drops the plain colour its accent colour replaces.
const row = (collapsed, active, extra = '') => `${active ? ROW.replace('text-sidebar-foreground ', '') : ROW}${active ? ` ${ACTIVE}` : ''}${collapsed ? ` ${COLLAPSED_ROW}` : ''}${extra}`;
const SUB_BTN = (active, size) => `flex min-w-0 items-center gap-2 rounded-md px-2 text-sm no-underline ${active ? '' : 'text-sidebar-foreground/80 '}${size === 'md' ? 'h-8' : 'h-7'} hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors [&>span]:truncate [&>svg]:size-4 [&>svg]:shrink-0${active ? ' bg-sidebar-accent font-medium text-sidebar-accent-foreground' : ''}`;
const SKEL = 'animate-pulse bg-primary/10';

// A case is { collapsed, variant, side, mode, collapsible, subOpen, focusRail }.
const ref = ({ collapsed = false, variant = 'sidebar', side = 'left', mode = 'icon', subOpen = true, railOn = false, skeleton = true } = {}) => {
    const VARIANT = { sidebar: 'h-screen border-e border-sidebar-border', floating: 'm-2 h-[calc(100vh-1rem)] rounded-lg border border-sidebar-border shadow-lg', inset: 'm-2 h-[calc(100vh-1rem)] rounded-lg border-none shadow-none' };
    const width = collapsed ? (mode === 'hidden' ? 'w-0 border-none overflow-hidden' : 'w-[60px]') : 'w-[280px]';
    const aside = `flex flex-col bg-sidebar text-sidebar-foreground sticky top-0 hidden md:flex ${VARIANT[variant]} transition-[width] duration-300 ease-in-out ${width}`;
    const header = `<ui-sidebar-header class="contents"><div class="flex flex-col gap-2 p-4${collapsed ? ' overflow-hidden [&>*]:sr-only' : ''}" data-slot="sidebar-header"><div class="font-semibold">Acme Inc</div></div></ui-sidebar-header>`;
    const label = `<ui-sidebar-group-label class="contents"><div class="px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70${collapsed ? ' sr-only' : ''}" data-slot="sidebar-group-label">Workspace</div></ui-sidebar-group-label>`;
    const link = (icon, text, active) => `<ui-sidebar-menu-item role="listitem" class="relative list-none"><ui-sidebar-menu-link class="contents"><a class="${row(collapsed, active, ' no-underline')}" href="#">${icon}<span>${text}</span></a></ui-sidebar-menu-link>`;
    const badge = `<ui-sidebar-menu-badge class="contents"><span class="${collapsed ? 'pointer-events-none absolute flex items-center justify-center rounded-full font-medium tabular-nums text-sidebar-accent-foreground end-1 top-1 h-2 min-w-2 translate-y-0 p-0 text-[0px] bg-sidebar-primary' : 'pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium tabular-nums bg-sidebar-accent text-sidebar-accent-foreground'}" aria-hidden="true">12</span></ui-sidebar-menu-badge>`;
    const open = subOpen && !collapsed;
    const subItem = (text, active) => `<ui-sidebar-menu-sub-item role="listitem" class="relative list-none"><ui-sidebar-menu-sub-button class="contents"><a class="${SUB_BTN(active, 'sm')}" href="#"><span>${text}</span></a></ui-sidebar-menu-sub-button></ui-sidebar-menu-sub-item>`;
    const menu = [
        `${link(HOME, 'Dashboard', true)}</ui-sidebar-menu-item>`,
        `${link(MAIL, 'Inbox', false)}${badge}</ui-sidebar-menu-item>`,
        `<ui-sidebar-menu-item role="listitem" class="relative list-none"><ui-sidebar-menu-sub-trigger class="contents"><button type="button" class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors${collapsed ? ' justify-center px-2 overflow-hidden [&>span:not(:first-child)]:sr-only [&>svg:last-child]:hidden' : ''}" aria-expanded="${open}">${FOLDER}<span>Projects</span><svg class="ms-auto size-4 shrink-0 text-sidebar-foreground/60 transition-transform duration-300 motion-reduce:transition-none${open ? ' rotate-90' : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button></ui-sidebar-menu-sub-trigger>`
        + `<ui-sidebar-menu-sub class="contents"><div class="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}"><div class="overflow-hidden"><ul class="flex min-w-0 flex-col gap-1 ps-4 ms-3.5 border-s border-sidebar-border transition-opacity duration-200 motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0'}"${open ? '' : ' inert'}>${subItem('Apollo', true)}${subItem('Borealis', false)}</ul></div></div></ui-sidebar-menu-sub></ui-sidebar-menu-item>`,
        `${link(ICON('<circle cx="12" cy="12" r="3"/>'), 'Settings', false)}<ui-sidebar-menu-action class="contents"><button type="button" class="absolute end-1 top-1/2 -translate-y-1/2 flex items-center justify-center size-6 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-opacity [&>svg]:size-4 [&>svg]:shrink-0${collapsed ? ' hidden' : ''}" aria-label="Settings options">${MORE}</button></ui-sidebar-menu-action></ui-sidebar-menu-item>`,
        skeleton ? `<ui-sidebar-menu-skeleton role="listitem" class="contents"><div class="flex h-9 items-center gap-2 rounded-md px-2${collapsed ? ' justify-center' : ''}"><ui-skeleton class="size-4 shrink-0 rounded-md ${SKEL}"></ui-skeleton>${collapsed ? '' : `<ui-skeleton class="h-4 rounded-md w-[55%] ${SKEL}"></ui-skeleton>`}</div></ui-sidebar-menu-skeleton>` : '',
    ].join('');
    const content = `<ui-sidebar-content class="contents"><ui-scroll-area class="contents"><div class="relative overflow-hidden flex-1 py-2" data-slot="scroll-area"><div class="size-full rounded-[inherit] overflow-auto scrollbar-none focus-visible:ring-ring/50 transition-[color,box-shadow] outline-none focus-visible:ring-[3px]" data-slot="scroll-area-viewport" tabindex="0"><ui-sidebar-group class="contents"><div class="flex flex-col gap-1 px-2 py-2" data-slot="sidebar-group">${label}<ui-sidebar-group-content class="contents"><div class="flex flex-col gap-1"><ui-sidebar-menu class="contents"><ul class="flex flex-col gap-1">${menu}</ul></ui-sidebar-menu></div></ui-sidebar-group-content></div></ui-sidebar-group></div></div></ui-scroll-area></ui-sidebar-content>`;
    const footer = `<ui-sidebar-footer class="contents"><div class="flex flex-col gap-2 p-4 mt-auto" data-slot="sidebar-footer"><ui-sidebar-separator class="contents"><hr class="mx-2 my-2 border-t border-sidebar-border" data-slot="sidebar-separator"></ui-sidebar-separator><div class="text-xs text-muted-foreground">v1.0</div></div></ui-sidebar-footer>`;
    const label2 = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    const rail = `<ui-sidebar-rail class="contents"><button type="button" class="absolute inset-y-0 z-20 hidden w-4 md:flex items-center justify-center outline-none ${side === 'left' ? '-end-2' : '-start-2'} ${collapsed ? 'cursor-e-resize' : 'cursor-w-resize'}" data-slot="sidebar-rail" aria-label="${label2}" title="${label2}"><span aria-hidden="true" class="absolute inset-y-2 w-0.5 rounded-full transition-all duration-200 ease-out motion-reduce:transition-none ${railOn ? 'bg-sidebar-primary opacity-100' : 'bg-sidebar-border opacity-0'} ${side === 'left' ? 'end-1' : 'start-1'}"></span></button></ui-sidebar-rail>`;
    const inset = `<ui-sidebar-inset class="flex flex-1 flex-col min-w-0 max-h-screen"><main class="flex flex-1 flex-col overflow-hidden" data-slot="sidebar-inset"><header class="flex h-12 items-center border-b px-4"><ui-sidebar-trigger class="contents"><button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Toggle sidebar">${PANEL}<span class="sr-only">Toggle Sidebar</span></button></ui-sidebar-trigger><span class="ml-4 text-sm font-medium">Main content</span></header><div class="p-4"><p class="text-muted-foreground">Content</p></div></main></ui-sidebar-inset>`;
    const sidebar = `<ui-sidebar class="contents"><aside class="${aside}" data-slot="sidebar" tabindex="-1">${header}${content}${footer}${rail}</aside></ui-sidebar>`;
    return `<ui-sidebar-provider class="contents"><div class="flex min-h-screen w-full overflow-hidden" data-slot="sidebar-provider">${side === 'right' ? inset + sidebar : sidebar + inset}</div></ui-sidebar-provider>`;
};

const shell = (opts, id) => {
    const { collapsed = false, variant = 'sidebar', side = 'left', mode = 'icon', subOpen = true, skeleton = true } = opts;
    const attrs = `${variant === 'sidebar' ? '' : ` variant="${variant}"`}${mode === 'hidden' ? ' collapse-mode="hidden"' : ''}${side === 'right' ? ' side="right"' : ''}`;
    const link = (icon, text, active) => `<ge-sidebar-menu-item><ge-sidebar-menu-link${active ? ' active' : ''}>${icon}<span>${text}</span></ge-sidebar-menu-link>`;
    const sidebar = `<ge-sidebar${attrs}>
<ge-sidebar-header><div style="font-weight:600">Acme Inc</div></ge-sidebar-header>
<ge-sidebar-content><ge-sidebar-group><ge-sidebar-group-label>Workspace</ge-sidebar-group-label><ge-sidebar-group-content><ge-sidebar-menu>
${link(HOME, 'Dashboard', true)}</ge-sidebar-menu-item>
${link(MAIL, 'Inbox', false)}<ge-sidebar-menu-badge>12</ge-sidebar-menu-badge></ge-sidebar-menu-item>
<ge-sidebar-menu-item><ge-sidebar-menu-sub-trigger for="parity-projects-${id}">${FOLDER}<span>Projects</span></ge-sidebar-menu-sub-trigger><ge-sidebar-menu-sub id="parity-projects-${id}"${subOpen ? '' : ' expanded="false"'}><ge-sidebar-menu-sub-item><ge-sidebar-menu-sub-button active><span>Apollo</span></ge-sidebar-menu-sub-button></ge-sidebar-menu-sub-item><ge-sidebar-menu-sub-item><ge-sidebar-menu-sub-button><span>Borealis</span></ge-sidebar-menu-sub-button></ge-sidebar-menu-sub-item></ge-sidebar-menu-sub></ge-sidebar-menu-item>
${link(ICON('<circle cx="12" cy="12" r="3"/>'), 'Settings', false)}<ge-sidebar-menu-action label="Settings options">${MORE}</ge-sidebar-menu-action></ge-sidebar-menu-item>
${skeleton ? '<ge-sidebar-menu-skeleton seed="1"></ge-sidebar-menu-skeleton>' : ''}
</ge-sidebar-menu></ge-sidebar-group-content></ge-sidebar-group></ge-sidebar-content>
<ge-sidebar-footer><ge-sidebar-separator></ge-sidebar-separator><div style="font-size:.75rem;line-height:1rem;color:var(--muted-foreground)">v1.0</div></ge-sidebar-footer>
<ge-sidebar-rail${side === 'right' ? ' side="right"' : ''}></ge-sidebar-rail>
</ge-sidebar>`;
    const inset = '<ge-sidebar-inset><header style="display:flex;height:3rem;align-items:center;border-bottom:1px solid var(--border);padding-inline:1rem"><ge-sidebar-trigger></ge-sidebar-trigger><span style="margin-left:1rem;font-size:.875rem;line-height:1.25rem;font-weight:500">Main content</span></header><div style="padding:1rem"><p style="margin:0;color:var(--muted-foreground)">Content</p></div></ge-sidebar-inset>';
    return `<ge-sidebar-provider persist-collapsed="false"${collapsed ? ' data-collapsed' : ''}>${side === 'right' ? inset + sidebar : sidebar + inset}</ge-sidebar-provider>`;
};

const W = 'width:900px;height:380px;overflow:hidden;border:1px solid var(--border);';
const c = (id, opts, extra = {}) => ({ id, wrap: W, ref: ref(opts), el: shell(opts, id), ...extra });
export default {
    name: 'sidebar',
    isolated: true,
    width: 1000,
    items: [
        c('expanded', {}),
        c('collapsed', { collapsed: true }),
        c('sub-closed', { subOpen: false }),
        c('floating', { variant: 'floating' }),
        c('inset', { variant: 'inset' }),
        c('floating-collapsed', { variant: 'floating', collapsed: true }),
        c('right', { side: 'right' }),
        c('right-collapsed', { side: 'right', collapsed: true }),
        c('hidden-collapsed', { collapsed: true, mode: 'hidden' }),
        c('rail-focused', { railOn: true }, { focus: { ref: "[data-slot='sidebar-rail']", el: 'ge-sidebar-rail button' } }),
    ],
};
