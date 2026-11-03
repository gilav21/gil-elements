// shadcn-angular menubar.component.ts and sub/*.component.ts (+ their density css).
const TRIGGER = 'flex cursor-pointer select-none items-center rounded-sm text-sm font-medium outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground';
const PANEL = 'absolute top-full z-50 mt-1 min-w-[12rem] max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-1 text-popover-foreground shadow-md ltr:left-0 rtl:right-0';
const ITEM = 'relative flex cursor-pointer select-none items-center rounded-sm text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
const SUB_PANEL = 'absolute top-0 z-50 min-w-[8rem] max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-1 shadow-md max-sm:left-0 max-sm:top-full max-sm:mt-0.5 sm:ltr:left-full sm:ltr:ml-0.5 sm:rtl:right-full sm:rtl:mr-0.5';
const CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" class="h-4 w-4 ltr:ml-auto rtl:mr-auto rtl:rotate-180" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

const rItem = (text, { shortcut = '', hint = '', disabled = false, inset = false } = {}) =>
    `<ui-menubar-item class="contents"><div class="${ITEM}${inset ? ' ltr:pl-8 rtl:pr-8' : ''}" data-slot="menubar-item"${disabled ? ' data-disabled="true" aria-disabled="true"' : ''} role="menuitem" tabindex="-1">${text}${hint ? `<ui-menubar-shortcut class="contents"><span class="text-xs tracking-widest text-muted-foreground ltr:ml-auto rtl:mr-auto" data-slot="menubar-shortcut">${hint}</span></ui-menubar-shortcut>` : ''}${shortcut ? `<span class="ms-auto text-xs tracking-widest text-muted-foreground">${shortcut}</span>` : ''}</div></ui-menubar-item>`;
const rSep = '<ui-menubar-separator class="contents"><div class="-mx-1 my-1 h-px bg-muted" data-slot="menubar-separator"></div></ui-menubar-separator>';
const rSub = (open, inner) =>
    `<ui-menubar-sub class="relative block w-full" data-slot="menubar-sub"><ui-menubar-sub-trigger class="contents"><div class="${ITEM}${open ? ' bg-accent text-accent-foreground' : ''}" data-slot="menubar-sub-trigger" role="menuitem" tabindex="-1" aria-haspopup="true" aria-expanded="${open}">Share${CHEVRON}</div></ui-menubar-sub-trigger><ui-menubar-sub-content class="contents">${open ? `<div class="${SUB_PANEL}" data-slot="menubar-sub-content" role="menu" tabindex="-1">${inner}</div>` : ''}</ui-menubar-sub-content></ui-menubar-sub>`;
const rBody = (sub) =>
    [rItem('New tab', { hint: '⌘T' }), rItem('Open', { disabled: true }), rItem('Recent', { inset: true }), rSep, rSub(sub, rItem('Email link') + rItem('Messages', { shortcut: '⌘M' })), rItem('Print', { shortcut: '⌘P' })].join('');
const rMenu = (name, open, sub, body = rBody(sub)) =>
    `<ui-menubar-menu class="contents"><div class="relative" data-slot="menubar-menu" role="none"><ui-menubar-trigger class="contents"><button type="button" class="${TRIGGER}" data-slot="menubar-trigger" aria-expanded="${open}" aria-haspopup="menu" data-state="${open ? 'open' : 'closed'}" role="menuitem">${name}</button></ui-menubar-trigger><ui-menubar-content class="contents">${open ? `<div class="${PANEL}" data-slot="menubar-content" role="menu" tabindex="-1">${body}</div>` : ''}</ui-menubar-content></div></ui-menubar-menu>`;
const rBar = (openMenu, sub) =>
    `<ui-menubar class="contents"><div class="flex items-center rounded-md border bg-background" data-slot="menubar" role="menubar">${rMenu('File', openMenu === 'file', sub)}${rMenu('Edit', openMenu === 'edit', false, rItem('Undo') + rItem('Redo'))}${rMenu('View', false, false)}</div></ui-menubar>`;

const eItem = (text, attrs = '') => `<ge-menubar-item ${attrs}>${text}</ge-menubar-item>`;
const eMenu = (name, body, attrs = '') => `<ge-menubar-menu><ge-menubar-trigger ${attrs}>${name}</ge-menubar-trigger><ge-menubar-content>${body}</ge-menubar-content></ge-menubar-menu>`;
const eBody = (hover) =>
    `<ge-menubar-item>New tab<ge-menubar-shortcut>⌘T</ge-menubar-shortcut></ge-menubar-item>${eItem('Open', 'disabled')}${eItem('Recent', 'inset')}<ge-menubar-separator></ge-menubar-separator><ge-menubar-sub><ge-menubar-sub-trigger${hover ? ' data-hover' : ''}>Share</ge-menubar-sub-trigger><ge-menubar-sub-content>${eItem('Email link')}${eItem('Messages', 'shortcut="⌘M"')}</ge-menubar-sub-content></ge-menubar-sub>${eItem('Print', 'shortcut="⌘P"')}`;
const eBar = (openMenu, hover) =>
    `<ge-menubar>${eMenu('File', eBody(hover), openMenu === 'file' ? 'data-click' : '')}${eMenu('Edit', eItem('Undo') + eItem('Redo'), openMenu === 'edit' ? 'data-click' : '')}${eMenu('View', '')}</ge-menubar>`;

const W = (extra = '') => `width:560px;height:240px;box-sizing:content-box;${extra}`;
const rtl = (html) => `<div dir="rtl">${html}</div>`;
const items = [
    { id: 'closed', wrap: W(), ref: rBar(''), el: eBar('') },
    { id: 'open-file', wrap: W(), ref: rBar('file'), el: eBar('file') },
    { id: 'open-edit', wrap: W(), ref: rBar('edit'), el: eBar('edit') },
    { id: 'submenu', wrap: W(), ref: rBar('file', true), el: eBar('file', true) },
    { id: 'density-1.5', wrap: W('--density:1.5;'), ref: rBar('file', true), el: eBar('file', true) },
    { id: 'rtl-open', wrap: W(), ref: rtl(rBar('file')), el: rtl(eBar('file')) },
    { id: 'rtl-submenu', wrap: W(), ref: rtl(rBar('file', true)), el: rtl(eBar('file', true)) },
];
export default { name: 'menubar', isolated: true, items };
