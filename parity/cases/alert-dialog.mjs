// shadcn-angular alert-dialog.component.ts, sub/alert-dialog-content.component.ts and the sub/ parts.
// The case wrapper has will-change: transform, so the fixed overlay fills the wrapper instead of the viewport.
const PANEL = 'fixed z-50 grid w-full max-w-[calc(100vw-2rem)] sm:max-w-lg gap-3 sm:gap-4 border bg-background p-4 sm:p-6 shadow-lg duration-200 sm:rounded-lg';
const CANCEL = 'inline-flex items-center justify-center rounded-md border border-input bg-background text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 mt-2 sm:mt-0';
const ACTION = 'inline-flex items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const header = (title, description) =>
    `<ui-alert-dialog-header class="flex flex-col space-y-2 text-center sm:text-left rtl:text-right"><ui-alert-dialog-title class="text-lg font-semibold">${title}</ui-alert-dialog-title>${description ? `<ui-alert-dialog-description class="text-sm text-muted-foreground">${description}</ui-alert-dialog-description>` : ''}</ui-alert-dialog-header>`;
const footer = (cancel, action) =>
    `<ui-alert-dialog-footer class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-[10px]"><ui-alert-dialog-cancel class="contents"><button class="${CANCEL}" data-slot="alert-dialog-cancel">${cancel}</button></ui-alert-dialog-cancel><ui-alert-dialog-action class="contents"><button class="${ACTION}" data-slot="alert-dialog-action">${action}</button></ui-alert-dialog-action></ui-alert-dialog-footer>`;
const body = '<p class="text-sm">Your account and everything in it will be removed.</p>';
const panel = (inner) =>
    `<ui-alert-dialog class="contents"><ui-alert-dialog-content class="contents"><div class="fixed inset-0 z-50 flex items-center justify-center" tabindex="-1"><div class="fixed inset-0 bg-black/80 animate-in fade-in-0"></div><div class="${PANEL}" role="alertdialog" data-slot="alert-dialog-content" tabindex="-1">${inner}</div></div></ui-alert-dialog-content></ui-alert-dialog>`;

const elBody = '<p style="margin:0;font-size:0.875rem;line-height:1.25rem">Your account and everything in it will be removed.</p>';
const elDialog = (content) => `<ge-alert-dialog open>${content}</ge-alert-dialog>`;
const SIMPLE_EL = (attrs = '') => elDialog(`<ge-alert-dialog-content heading="Are you absolutely sure?" description="This action cannot be undone."${attrs}>${elBody}</ge-alert-dialog-content>`);
const SIMPLE_REF = (cancel = 'Cancel', action = 'Continue') => panel(`${header('Are you absolutely sure?', 'This action cannot be undone.')}${body}${footer(cancel, action)}`);

const W = 'width:640px;height:420px;';
const items = [
    { id: 'simple', wrap: W, ref: SIMPLE_REF(), el: SIMPLE_EL() },
    { id: 'simple-custom-labels', wrap: W, ref: SIMPLE_REF('Keep it', 'Delete'), el: SIMPLE_EL(' cancel-text="Keep it" action-text="Delete"') },
    { id: 'custom', wrap: W, ref: panel(`${header('Discard changes?')}${footer('Stay', 'Discard')}`), el: elDialog('<ge-alert-dialog-content><ge-alert-dialog-header><ge-alert-dialog-title>Discard changes?</ge-alert-dialog-title></ge-alert-dialog-header><ge-alert-dialog-footer><ge-alert-dialog-cancel>Stay</ge-alert-dialog-cancel><ge-alert-dialog-action>Discard</ge-alert-dialog-action></ge-alert-dialog-footer></ge-alert-dialog-content>') },
    { id: 'body-only', wrap: W, ref: panel(body), el: elDialog(`<ge-alert-dialog-content>${elBody}</ge-alert-dialog-content>`) },
    { id: 'density-1.5', wrap: `${W}--density:1.5;`, ref: SIMPLE_REF(), el: SIMPLE_EL() },
    { id: 'rtl', wrap: W, ref: `<div dir="rtl">${SIMPLE_REF()}</div>`, el: `<div dir="rtl">${SIMPLE_EL()}</div>` },
    { id: 'focus-action', wrap: W, focus: { ref: '[data-slot=alert-dialog-action]', el: 'ge-alert-dialog-action' }, ref: SIMPLE_REF(), el: SIMPLE_EL() },
];
export default { name: 'alert-dialog', items };
