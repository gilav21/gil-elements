// shadcn-angular result.component.html and sub/result-detail.component.html: the class strings, copied.
import { ref as button } from '../lib/button-ref.mjs';
const PANEL = 'flex w-full flex-col items-center gap-2 p-4 text-center sm:gap-3 sm:p-6';
const COLOUR = {
    success: 'text-green-600 dark:text-green-500',
    error: 'text-destructive',
    warning: 'text-amber-600 dark:text-amber-500',
    info: 'text-blue-600 dark:text-blue-500',
};
const GLYPH = {
    success: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Zm-3.5-9 2.5 2.5 4.5-4.5',
    error: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18ZM9 9l6 6m0-6-6 6',
    warning: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01',
    info: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Zm0-13h.01M11 12h1v4h1',
};
const DETAIL = 'w-full max-w-full overflow-x-auto rounded-md border bg-muted/40 p-3 text-start text-sm';

const ref = ({ status = 'info', title, description, detail, actions }) =>
    `<ui-result class="contents" data-slot="result-host"><output class="${PANEL}" data-slot="result" aria-live="polite"><div class="flex items-center justify-center ${COLOUR[status]}" data-slot="result-icon" data-status="${status}" aria-hidden="true"><svg class="size-10 sm:size-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${GLYPH[status]}"/></svg></div>${title ? `<div class="text-lg font-semibold text-balance sm:text-xl" data-slot="result-title">${title}</div>` : ''}${description ? `<p class="max-w-prose text-sm text-muted-foreground text-balance" data-slot="result-description">${description}</p>` : ''}${detail ? `<ui-result-detail class="contents"><div class="${DETAIL}" data-slot="result-detail" aria-live="off">${detail}</div></ui-result-detail>` : ''}<div class="flex w-full flex-wrap items-center justify-center gap-2 empty:hidden" data-slot="result-actions">${actions ? actions.ref : ''}</div></output></ui-result>`;
const el = ({ status, title, description, detail, actions }) =>
    `<ge-result${status ? ` status="${status}"` : ''}${title ? ` heading="${title}"` : ''}${description ? ` description="${description}"` : ''}>${detail ? `<ge-result-detail>${detail}</ge-result-detail>` : ''}${actions ? actions.el : ''}</ge-result>`;

const ACTIONS = { ref: button('default', 'default', 'Back to dashboard') + button('outline', 'default', 'View receipt'), el: '<ge-button>Back to dashboard</ge-button><ge-button variant="outline">View receipt</ge-button>' };
const DESC = 'We emailed your receipt to you. It can take a few minutes to arrive in your inbox.';
const W = 'width:34rem;';
const base = { title: 'Payment received', description: DESC, actions: ACTIONS };
export default {
    name: 'result',
    items: [
        ...['success', 'error', 'warning', 'info'].map((status) => ({ id: status, wrap: W, ref: ref({ ...base, status }), el: el({ ...base, status }) })),
        { id: 'default-status', wrap: W, ref: ref({ ...base }), el: el({ ...base }) },
        { id: 'title-only', wrap: W, ref: ref({ status: 'success', title: 'Saved' }), el: el({ status: 'success', title: 'Saved' }) },
        { id: 'detail', wrap: W, ref: ref({ ...base, status: 'error', title: 'Upload failed', detail: 'Error 413: the file is larger than the 10 MB limit.' }), el: el({ ...base, status: 'error', title: 'Upload failed', detail: 'Error 413: the file is larger than the 10 MB limit.' }) },
        { id: 'narrow', wrap: 'width:20rem;', ref: ref({ ...base, status: 'warning' }), el: el({ ...base, status: 'warning' }) },
        { id: 'rtl', wrap: W, ref: `<div dir="rtl">${ref({ ...base, status: 'success' })}</div>`, el: `<div dir="rtl">${el({ ...base, status: 'success' })}</div>` },
    ],
};
