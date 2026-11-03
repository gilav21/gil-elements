// shadcn-angular dropdown-menu.component.ts and sub/*.component.ts (+ dropdown-menu-item.component.css).
import { ref as button } from '../lib/button-ref.mjs';

const PANEL = 'absolute top-full z-50 mt-1 min-w-[8rem] max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-1 text-popover-foreground shadow-md';
const ALIGN = { start: 'ltr:left-0 rtl:right-0', center: 'left-1/2 -translate-x-1/2', end: 'ltr:right-0 rtl:left-0' };
const ITEM = 'relative flex cursor-pointer select-none items-center rounded-sm text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground';
const FOCUSED = 'bg-accent text-accent-foreground';
const SUB_TRIGGER = 'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
const SUB_PANEL = 'absolute top-0 z-50 min-w-[8rem] max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-1 text-popover-foreground shadow-md ltr:left-full ltr:ml-1 ltr:animate-in ltr:slide-in-from-left-1 ltr:fade-in-0 ltr:zoom-in-95 rtl:right-full rtl:mr-1 rtl:animate-in rtl:slide-in-from-right-1 rtl:fade-in-0 rtl:zoom-in-95';
const CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" class="h-4 w-4 ltr:ml-auto rtl:mr-auto rtl:rotate-180" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

const rItem = (text, { shortcut = '', disabled = false, inset = false, focused = false } = {}) =>
    `<ui-dropdown-menu-item class="${ITEM}${disabled ? ' pointer-events-none opacity-50' : ''}${inset ? ' ltr:pl-8 rtl:pr-8' : ''}${focused ? ` ${FOCUSED}` : ''}" data-slot="dropdown-item"${disabled ? ' data-disabled="true" aria-disabled="true"' : ''} role="menuitem" tabindex="-1">${text}${shortcut ? `<span class="ms-auto text-xs tracking-widest text-muted-foreground">${shortcut}</span>` : ''}</ui-dropdown-menu-item>`;
// The two block hosts follow shadcn-angular issue (separator and label hosts are inline elements with no display rule).
const rLabel = (text) => `<ui-dropdown-menu-label class="block px-2 py-1.5 text-sm font-semibold" data-slot="dropdown-label">${text}</ui-dropdown-menu-label>`;
const rSep = '<ui-dropdown-menu-separator class="block -mx-1 my-1 h-px bg-border" data-slot="dropdown-separator"></ui-dropdown-menu-separator>';
const rSub = (open, inner = '') =>
    `<ui-dropdown-menu-sub class="relative block w-full" data-slot="dropdown-menu-sub"><ui-dropdown-menu-sub-trigger class="contents"><div class="${SUB_TRIGGER}${open ? ' bg-accent text-accent-foreground' : ''}" data-slot="dropdown-menu-sub-trigger" role="menuitem" tabindex="-1" aria-haspopup="true" aria-expanded="${open}">More tools${CHEVRON}</div></ui-dropdown-menu-sub-trigger><ui-dropdown-menu-sub-content class="contents">${open ? `<div class="${SUB_PANEL}" data-slot="dropdown-menu-sub-content" role="menu" tabindex="-1">${inner}</div>` : ''}</ui-dropdown-menu-sub-content></ui-dropdown-menu-sub>`;

const BODY = (opts = {}) =>
    [rLabel('My account'), rItem('Profile', { shortcut: '⇧⌘P' }), rItem('Billing', { disabled: true }), rItem('Settings', { inset: true }), rSep, rSub(opts.sub, rItem('Save page') + rItem('Print', { shortcut: '⌘P' })), rItem('Log out')].join('');
const ref = (align, opts = {}) =>
    `<ui-dropdown-menu class="relative inline-block" data-slot="dropdown-menu"><ui-dropdown-menu-trigger class="contents"><span class="" role="button" tabindex="0" data-slot="dropdown-trigger">${button('outline', 'default', 'Open')}</span></ui-dropdown-menu-trigger><ui-dropdown-menu-content class="contents"><div class="${PANEL} ${ALIGN[align]}" data-slot="dropdown-content" role="menu" tabindex="-1">${BODY(opts)}</div></ui-dropdown-menu-content></ui-dropdown-menu>`;

const eItem = (text, attrs = '') => `<ge-dropdown-menu-item ${attrs}>${text}</ge-dropdown-menu-item>`;
const eBody = (hover) =>
    `<ge-dropdown-menu-label>My account</ge-dropdown-menu-label>${eItem('Profile', 'shortcut="⇧⌘P"')}${eItem('Billing', 'disabled')}${eItem('Settings', 'inset')}<ge-dropdown-menu-separator></ge-dropdown-menu-separator><ge-dropdown-menu-sub><ge-dropdown-menu-sub-trigger${hover ? ' data-hover' : ''}>More tools</ge-dropdown-menu-sub-trigger><ge-dropdown-menu-sub-content>${eItem('Save page')}${eItem('Print', 'shortcut="⌘P"')}</ge-dropdown-menu-sub-content></ge-dropdown-menu-sub>${eItem('Log out')}`;
const el = (align, hover = false) =>
    `<ge-dropdown-menu open><ge-dropdown-menu-trigger><ge-button variant="outline">Open</ge-button></ge-dropdown-menu-trigger><ge-dropdown-menu-content align="${align}">${eBody(hover)}</ge-dropdown-menu-content></ge-dropdown-menu>`;

const W = (extra = '') => `width:560px;height:280px;padding:20px 0 0 240px;box-sizing:content-box;${extra}`;
const items = [
    ...['start', 'center', 'end'].map((align) => ({ id: `align-${align}`, wrap: W(), ref: ref(align), el: el(align) })),
    { id: 'density-1.5', wrap: W('--density:1.5;'), ref: ref('start'), el: el('start') },
    { id: 'rtl-start', wrap: W(), ref: `<div dir="rtl">${ref('start')}</div>`, el: `<div dir="rtl">${el('start')}</div>` },
    { id: 'rtl-end', wrap: W('padding-left:0;padding-right:240px;'), ref: `<div dir="rtl">${ref('end')}</div>`, el: `<div dir="rtl">${el('end')}</div>` },
    { id: 'submenu', wrap: W(), ref: ref('start', { sub: true }), el: el('start', true) },
    { id: 'submenu-rtl', wrap: W(), ref: `<div dir="rtl">${ref('start', { sub: true })}</div>`, el: `<div dir="rtl">${el('start', true)}</div>` },
    { id: 'focused-item', wrap: W(), ref: ref('start'), el: el('start'), focus: { ref: 'ui-dropdown-menu-item', el: 'ge-dropdown-menu-item' } },
    { id: 'closed', wrap: W(), ref: ref('start').replace(/<ui-dropdown-menu-content.*<\/ui-dropdown-menu-content>/, ''), el: el('start').replace('<ge-dropdown-menu open>', '<ge-dropdown-menu>') },
];
export default { name: 'dropdown-menu', isolated: true, items };
