// shadcn-angular sheet.component.ts (sheetVariants), sub/sheet-content.component.ts and the sub/ parts.
// The case wrapper has will-change: transform, so the fixed overlay fills the wrapper instead of the viewport.
const BASE = 'fixed z-50 gap-4 bg-background p-4 sm:p-6 shadow-lg transition ease-in-out overflow-y-auto';
const SIDE = {
    top: 'inset-x-0 top-0 border-b',
    bottom: 'inset-x-0 bottom-0 border-t',
    left: 'inset-y-0 ltr:left-0 rtl:right-0 h-full w-3/4 ltr:border-r rtl:border-l sm:max-w-sm',
    right: 'inset-y-0 ltr:right-0 rtl:left-0 h-full w-3/4 ltr:border-l rtl:border-r sm:max-w-sm',
};
const CLOSE = 'absolute end-4 top-4 inline-flex items-center justify-center rounded-sm opacity-70 pointer-coarse:end-0.5 pointer-coarse:top-0.5 pointer-coarse:size-11 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none';
const X = '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>';

const header = (title, description) =>
    `<ui-sheet-header class="flex flex-col space-y-2 text-center sm:ltr:text-left sm:rtl:text-right"><ui-sheet-title class="text-lg font-semibold text-foreground">${title}</ui-sheet-title>${description ? `<ui-sheet-description class="text-sm text-muted-foreground">${description}</ui-sheet-description>` : ''}</ui-sheet-header>`;
const body = '<p class="text-sm">Update your name and email. Changes are saved to your account.</p>';
const panel = (side, inner) =>
    `<ui-sheet class="contents"><ui-sheet-content class="contents"><div class="fixed inset-0 z-50" role="dialog" aria-modal="true"><div class="fixed inset-0 bg-black/50 animate-in fade-in-0" aria-hidden="true"></div><div class="${BASE} ${SIDE[side]}" data-slot="sheet-content" data-state="open" tabindex="-1">${inner}<button type="button" class="${CLOSE}" aria-label="Close">${X}<span class="sr-only">Close</span></button></div></div></ui-sheet-content></ui-sheet>`;

const elBody = '<p style="margin:0;font-size:0.875rem;line-height:1.25rem">Update your name and email. Changes are saved to your account.</p>';
const elSheet = (side, content, attrs = '') => `<ge-sheet open><ge-sheet-content side="${side}"${attrs}>${content}</ge-sheet-content></ge-sheet>`;
const SIMPLE = (side) => ({ ref: panel(side, `${header('Edit profile', 'Make changes to your profile here.')}${body}`), el: elSheet(side, elBody, ' heading="Edit profile" description="Make changes to your profile here."') });

const W = 'width:640px;height:420px;';
const items = [
    ...['right', 'left', 'top', 'bottom'].map((side) => ({ id: `simple-${side}`, wrap: W, ...SIMPLE(side) })),
    { id: 'custom', wrap: W, ref: panel('right', `${header('Filters')}${body}<div class="flex flex-col-reverse sm:flex-row sm:justify-end sm:ltr:space-x-2 sm:rtl:space-x-reverse" data-slot="sheet-footer"><span>Apply</span><span>Reset</span></div>`), el: elSheet('right', `<ge-sheet-header><ge-sheet-title>Filters</ge-sheet-title></ge-sheet-header>${elBody}<ge-sheet-footer><span>Apply</span><span>Reset</span></ge-sheet-footer>`) },
    { id: 'body-only', wrap: W, ref: panel('right', body), el: elSheet('right', elBody) },
    { id: 'long-body-scrolls', wrap: W, ref: panel('right', `${header('Terms')}${Array.from({ length: 30 }, () => body).join('')}`), el: elSheet('right', elBody.repeat(30), ' heading="Terms"') },
    { id: 'rtl-right', wrap: W, ref: `<div dir="rtl">${SIMPLE('right').ref}</div>`, el: `<div dir="rtl">${SIMPLE('right').el}</div>` },
    { id: 'rtl-left', wrap: W, ref: `<div dir="rtl">${SIMPLE('left').ref}</div>`, el: `<div dir="rtl">${SIMPLE('left').el}</div>` },
    { id: 'focus-close', wrap: W, focus: { ref: 'button.absolute', el: '.close' }, ...SIMPLE('right') },
];
export default { name: 'sheet', items };
