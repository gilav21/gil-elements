// shadcn-angular dialog.component.ts, sub/dialog-content.component.html (+ .css), sub/dialog-header/title/description/footer.
// The case wrapper has will-change: transform, so the fixed overlay fills the wrapper instead of the viewport.
import { ref as button } from '../lib/button-ref.mjs';

const PANEL = 'fixed z-50 grid w-full max-w-[calc(100vw-2rem)] sm:max-w-lg border bg-background shadow-lg duration-200 sm:rounded-lg';
const CLOSE = 'absolute end-4 top-4 inline-flex items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none pointer-coarse:end-0.5 pointer-coarse:top-0.5 pointer-coarse:size-11';
const X = '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>';

const header = (title, description) =>
    `<ui-dialog-header class="flex flex-col text-center sm:text-left" data-slot="dialog-header"><ui-dialog-title class="text-lg font-semibold leading-none tracking-tight flex justify-start" data-slot="dialog-title">${title}</ui-dialog-title>${description ? `<ui-dialog-description class="text-sm text-muted-foreground flex justify-start" data-slot="dialog-description">${description}</ui-dialog-description>` : ''}</ui-dialog-header>`;
const footer = `<ui-dialog-footer class="flex flex-col-reverse sm:flex-row sm:justify-end" data-slot="dialog-footer">${button('outline', 'default', 'Cancel')}${button('default', 'default', 'Save changes')}</ui-dialog-footer>`;
const body = '<p class="text-sm">Update your name and email. Changes are saved to your account.</p>';
const panel = (inner, label) =>
    `<ui-dialog class="contents" data-slot="dialog"><ui-dialog-content class="contents"><div class="fixed inset-0 z-50 flex items-center justify-center"><button type="button" class="fixed inset-0 bg-black/80 animate-in fade-in-0" data-slot="dialog-overlay" aria-label="Close"></button><div class="${PANEL}" role="dialog" aria-modal="true" ${label ? `aria-label="${label}"` : ''} data-slot="dialog-content" tabindex="-1">${inner}<button type="button" class="${CLOSE}" aria-label="Close">${X}<span class="sr-only">Close</span></button></div></div></ui-dialog-content></ui-dialog>`;

const elButtons = '<ge-button variant="outline">Cancel</ge-button><ge-button>Save changes</ge-button>';
const elFooter = `<ge-dialog-footer>${elButtons}</ge-dialog-footer>`;
const elBody = '<p style="margin:0;font-size:0.875rem;line-height:1.25rem">Update your name and email. Changes are saved to your account.</p>';
const elDialog = (content) => `<ge-dialog open>${content}</ge-dialog>`;

const W = 'width:640px;height:420px;';
const focusClose = { ref: 'button.absolute', el: '.close' };
const items = [
    { id: 'simple', wrap: W, ref: panel(`${header('Edit profile', 'Make changes to your profile here.')}${body}${footer}`, 'Edit profile'), el: elDialog(`<ge-dialog-content heading="Edit profile" description="Make changes to your profile here.">${elBody}${elFooter}</ge-dialog-content>`) },
    { id: 'custom', wrap: W, ref: panel(`${header('Delete project', 'This cannot be undone.')}${body}${footer}`), el: elDialog(`<ge-dialog-content><ge-dialog-header><ge-dialog-title>Delete project</ge-dialog-title><ge-dialog-description>This cannot be undone.</ge-dialog-description></ge-dialog-header>${elBody}${elFooter}</ge-dialog-content>`) },
    { id: 'heading-only', wrap: W, ref: panel(`${header('Welcome')}${body}`, 'Welcome'), el: elDialog(`<ge-dialog-content heading="Welcome">${elBody}</ge-dialog-content>`) },
    { id: 'body-only', wrap: W, ref: panel(body), el: elDialog(`<ge-dialog-content>${elBody}</ge-dialog-content>`) },
    { id: 'density-1.5', wrap: `${W}--density:1.5;`, ref: panel(`${header('Edit profile', 'Make changes to your profile here.')}${body}${footer}`, 'Edit profile'), el: elDialog(`<ge-dialog-content heading="Edit profile" description="Make changes to your profile here.">${elBody}${elFooter}</ge-dialog-content>`) },
    { id: 'rtl', wrap: W, ref: `<div dir="rtl">${panel(`${header('Edit profile', 'Make changes to your profile here.')}${body}${footer}`, 'Edit profile')}</div>`, el: `<div dir="rtl">${elDialog(`<ge-dialog-content heading="Edit profile" description="Make changes to your profile here.">${elBody}${elFooter}</ge-dialog-content>`)}</div>` },
    { id: 'focus-close', wrap: W, focus: focusClose, ref: panel(`${header('Welcome')}${body}`, 'Welcome'), el: elDialog(`<ge-dialog-content heading="Welcome">${elBody}</ge-dialog-content>`) },
];
export default { name: 'dialog', items };
