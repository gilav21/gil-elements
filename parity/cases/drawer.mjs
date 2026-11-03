// shadcn-angular drawer.component.ts (drawerVariants), sub/drawer-content.component.html and the sub/ parts.
// The case wrapper has will-change: transform, so the fixed overlay fills the wrapper instead of the viewport.
const BASE = 'fixed z-50 flex flex-col bg-background overflow-y-auto';
const DIRECTION = {
    top: 'inset-x-0 top-0 mb-24 max-h-[80vh] rounded-b-lg border-b',
    bottom: 'inset-x-0 bottom-0 mt-24 max-h-[80vh] rounded-t-lg border-t',
    left: 'inset-y-0 ltr:left-0 rtl:right-0 h-full w-3/4 ltr:border-r rtl:border-l sm:max-w-sm',
    right: 'inset-y-0 ltr:right-0 rtl:left-0 h-full w-3/4 ltr:border-l rtl:border-r sm:max-w-sm',
};
const HANDLE = '<div class="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted"></div>';

const header = (title, description) =>
    `<ui-drawer-header class="flex flex-col gap-1.5 p-4 text-center sm:ltr:text-left sm:rtl:text-right"><ui-drawer-title class="text-foreground font-semibold">${title}</ui-drawer-title>${description ? `<ui-drawer-description class="text-muted-foreground text-sm">${description}</ui-drawer-description>` : ''}</ui-drawer-header>`;
const body = '<p class="text-sm">Set your daily activity goal.</p>';
const panel = (direction, inner) =>
    `<ui-drawer class="contents" data-slot="drawer"><ui-drawer-content class="contents"><div class="fixed inset-0 z-50" role="dialog" aria-modal="true"><button type="button" class="fixed inset-0 bg-black/50 animate-in fade-in-0" data-slot="drawer-overlay" aria-label="Close" tabindex="-1"></button><div class="${BASE} ${DIRECTION[direction]}" data-slot="drawer-content" data-state="open" data-vaul-drawer-direction="${direction}" tabindex="-1">${direction === 'top' || direction === 'bottom' ? HANDLE : ''}${inner}</div></div></ui-drawer-content></ui-drawer>`;

const elBody = '<p style="margin:0;font-size:0.875rem;line-height:1.25rem">Set your daily activity goal.</p>';
const elDrawer = (direction, content, attrs = '') => `<ge-drawer open direction="${direction}"><ge-drawer-content${attrs}>${content}</ge-drawer-content></ge-drawer>`;
const SIMPLE = (direction) => ({ ref: panel(direction, `${header('Move goal', 'Set your daily activity goal.')}${body}`), el: elDrawer(direction, elBody, ' heading="Move goal" description="Set your daily activity goal."') });

const W = 'width:640px;height:420px;';
const footer = '<div class="mt-auto flex flex-col gap-2 p-4" data-slot="drawer-footer"><span>Submit</span><span>Cancel</span></div>';
const items = [
    ...['bottom', 'top', 'right', 'left'].map((direction) => ({ id: `simple-${direction}`, wrap: W, ...SIMPLE(direction) })),
    { id: 'default-direction', wrap: W, ref: SIMPLE('bottom').ref, el: `<ge-drawer open><ge-drawer-content heading="Move goal" description="Set your daily activity goal.">${elBody}</ge-drawer-content></ge-drawer>` },
    { id: 'footer-bottom', wrap: W, ref: panel('bottom', `${header('Move goal')}${body}${footer}`), el: elDrawer('bottom', `<ge-drawer-header><ge-drawer-title>Move goal</ge-drawer-title></ge-drawer-header>${elBody}<ge-drawer-footer><span>Submit</span><span>Cancel</span></ge-drawer-footer>`) },
    { id: 'footer-right', wrap: W, ref: panel('right', `${header('Move goal')}${body}${footer}`), el: elDrawer('right', `<ge-drawer-header><ge-drawer-title>Move goal</ge-drawer-title></ge-drawer-header>${elBody}<ge-drawer-footer><span>Submit</span><span>Cancel</span></ge-drawer-footer>`) },
    { id: 'body-only', wrap: W, ref: panel('bottom', body), el: elDrawer('bottom', elBody) },
    { id: 'long-body-scrolls', wrap: W, ref: panel('right', `${header('Terms')}${Array.from({ length: 30 }, () => body).join('')}`), el: elDrawer('right', elBody.repeat(30), ' heading="Terms"') },
    { id: 'rtl-right', wrap: W, ref: `<div dir="rtl">${SIMPLE('right').ref}</div>`, el: `<div dir="rtl">${SIMPLE('right').el}</div>` },
    { id: 'rtl-left', wrap: W, ref: `<div dir="rtl">${SIMPLE('left').ref}</div>`, el: `<div dir="rtl">${SIMPLE('left').el}</div>` },
    { id: 'rtl-bottom', wrap: W, ref: `<div dir="rtl">${SIMPLE('bottom').ref}</div>`, el: `<div dir="rtl">${SIMPLE('bottom').el}</div>` },
];
export default { name: 'drawer', items };
