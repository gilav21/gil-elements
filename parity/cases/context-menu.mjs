// shadcn-angular context-menu.component.ts and sub/*.component.ts. Angular portals the panels to <body> at fixed viewport
// coordinates; the reference places the same classes absolutely inside the case, at the offset the element is opened at.

const PANEL = 'min-w-[8rem] outline-none focus-visible:ring-1 focus-visible:ring-ring max-w-[calc(100vw-16px)] max-h-[calc(100vh-16px)] rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95';
const ITEM = 'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0';
const NORMAL = 'focus:bg-accent focus:text-accent-foreground';
const DESTRUCTIVE = 'text-destructive focus:bg-destructive/10 focus:text-destructive';
const SUB_TRIGGER = 'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
const SUB_PANEL = 'min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95';
const CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" class="h-4 w-4 ltr:ml-auto rtl:mr-auto rtl:rotate-180" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

const rItem = (text, { shortcut = '', disabled = false, inset = false, destructive = false, focused = false } = {}) =>
    `<ui-context-menu-item class="${ITEM} ${destructive ? DESTRUCTIVE : NORMAL}${inset ? ' ps-8' : ''}${disabled ? ' pointer-events-none opacity-50' : ''}${focused ? ' bg-accent text-accent-foreground' : ''}" data-slot="context-menu-item" role="menuitem" tabindex="-1"${disabled ? ' data-disabled="true" aria-disabled="true"' : ''}>${text}${shortcut ? `<span class="ms-auto text-xs tracking-widest text-muted-foreground">${shortcut}</span>` : ''}</ui-context-menu-item>`;
// The label and separator hosts are block here, as in the dropdown case (shadcn-angular issue 233).
const rLabel = (text, inset) => `<ui-context-menu-label class="block px-2 py-1.5 text-sm font-semibold text-foreground${inset ? ' ps-8' : ''}" data-slot="context-menu-label">${text}</ui-context-menu-label>`;
const rSep = '<ui-context-menu-separator class="block -mx-1 my-1 h-px bg-border" data-slot="context-menu-separator"></ui-context-menu-separator>';
const rSub = (open, inner, dir) =>
    `<ui-context-menu-sub class="relative block w-full" data-slot="context-menu-sub"><ui-context-menu-sub-trigger class="contents"><div class="${SUB_TRIGGER}${open ? ' bg-accent text-accent-foreground' : ''}" role="menuitem" tabindex="-1" aria-haspopup="true" aria-expanded="${open}" data-slot="context-menu-sub-trigger">More tools${CHEVRON}</div></ui-context-menu-sub-trigger><ui-context-menu-sub-content class="contents">${open ? `<div class="absolute top-0 ${dir === 'rtl' ? 'right-full mr-1' : 'left-full ml-1'} ${SUB_PANEL}" role="menu" tabindex="-1" data-slot="context-menu-sub-content">${inner}</div>` : ''}</ui-context-menu-sub-content></ui-context-menu-sub>`;

const BODY = (open, dir) =>
    [
        rLabel('Actions', true),
        rItem('Back', { shortcut: '⌘[', focused: true }),
        rItem('Forward', { disabled: true }),
        rItem('Reload', { shortcut: '⌘R', inset: true }),
        rSep,
        rSub(open, rItem('Save page') + rItem('Print', { shortcut: '⌘P' }), dir),
        rItem('Delete', { destructive: true }),
    ].join('');
// A fixed width keeps the flyout's position a whole number of pixels. Content-sized, its position follows the font's fractional
// text widths, and the top-layer flyout then paints its text on whole pixels where the reference's in-flow box does not.
const AREA = 'width:360px;height:300px;position:relative;border:1px dashed var(--border)';
// `overflow-auto` would clip the absolutely placed flyout, which Angular portals out of the panel.
const ref = (x, y, { open = false, dir = 'ltr', closed = false } = {}) =>
    `<div style="${AREA}" dir="${dir}"><ui-context-menu class="contents" data-slot="context-menu"><ui-context-menu-trigger class="contents"><span class="contents" data-slot="context-menu-trigger">Right click here</span></ui-context-menu-trigger><ui-context-menu-content class="contents">${closed ? '' : `<div class="absolute w-56 ${PANEL}" style="left:${x}px;top:${y}px" role="menu" tabindex="-1" data-state="open" data-slot="context-menu-content">${BODY(open, dir)}</div>`}</ui-context-menu-content></ui-context-menu></div>`;

const eItem = (text, attrs = '') => `<ge-context-menu-item ${attrs}>${text}</ge-context-menu-item>`;
const eBody = (hover) =>
    `<ge-context-menu-label inset>Actions</ge-context-menu-label><ge-context-menu-item>Back<ge-context-menu-shortcut>⌘[</ge-context-menu-shortcut></ge-context-menu-item>${eItem('Forward', 'disabled')}${eItem('Reload', 'inset shortcut="⌘R"')}<ge-context-menu-separator></ge-context-menu-separator><ge-context-menu-sub><ge-context-menu-sub-trigger${hover ? ' data-hover-on-show' : ''}>More tools</ge-context-menu-sub-trigger><ge-context-menu-sub-content>${eItem('Save page')}${eItem('Print', 'shortcut="⌘P"')}</ge-context-menu-sub-content></ge-context-menu-sub>${eItem('Delete', 'variant="destructive"')}`;
const el = (hover = false, dir = 'ltr') =>
    `<div style="${AREA}" dir="${dir}"><ge-context-menu><ge-context-menu-trigger>Right click here</ge-context-menu-trigger><ge-context-menu-content style="width:14rem">${eBody(hover)}</ge-context-menu-content></ge-context-menu></div>`;

const at = (x, y) => `${x},${y}`;
const items = [
    { id: 'default', ref: ref(40, 30), el: el(), show: at(40, 30) },
    { id: 'submenu', ref: ref(40, 30, { open: true }), el: el(true), show: at(40, 30) },
    { id: 'rtl', ref: ref(40, 30, { dir: 'rtl' }), el: el(false, 'rtl'), show: at(40, 30) },
    { id: 'rtl-submenu', ref: ref(120, 30, { open: true, dir: 'rtl' }), el: el(true, 'rtl'), show: at(120, 30) },
    { id: 'closed', ref: ref(40, 30, { closed: true }), el: el() },
];
export default { name: 'context-menu', isolated: true, items };
