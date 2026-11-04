// shadcn-angular toast.component.ts (toastVariants) and toast.component.html.
const BASE = 'group pointer-events-auto relative flex w-full items-center justify-between ltr:space-x-2 rtl:space-x-reverse overflow-hidden rounded-md border p-4 pe-6 pointer-coarse:pe-11 shadow-lg transition-all';
const VARIANT = {
    default: 'border bg-background text-foreground',
    destructive: 'destructive group border-destructive bg-destructive text-white',
    success: 'border-green-500 bg-green-500 text-white',
    info: 'border-blue-600 bg-blue-600 text-white',
    warning: 'border-amber-500 bg-amber-500 text-amber-950',
};
const ACTION = 'inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive';
const CLOSE = 'absolute end-1 top-1 inline-flex items-center justify-center rounded-md p-1 pointer-coarse:end-0 pointer-coarse:top-0 pointer-coarse:size-11 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100 [@media(hover:none)]:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600';
const X = '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>';

const ref = ({ variant = 'default', heading = '', description = '', action = '', countdown = null, duration = null, loading = false, rtl = false } = {}) => {
    const alert = variant === 'destructive';
    const showCountdown = countdown !== null;
    const percent = duration && countdown !== null ? Math.max(0, (countdown / Math.ceil(duration / 1000)) * 100) : 0;
    return `<ui-toast class="contents"><div class="${BASE} ${VARIANT[variant]}" data-slot="toast" role="${alert ? 'alert' : 'status'}" aria-live="${alert ? 'assertive' : 'polite'}" dir="${rtl ? 'rtl' : 'ltr'}">${
        loading ? '<div class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" data-slot="toast-spinner" aria-hidden="true"></div>' : ''
    }<div class="grid gap-1 flex-1">${heading ? `<div class="text-sm font-semibold" data-slot="toast-title">${heading}</div>` : ''}${description ? `<div class="text-sm opacity-90" data-slot="toast-description">${description}</div>` : ''}</div>${
        action ? `<button class="${ACTION}">${action}${showCountdown ? `<span class="ltr:ml-1 rtl:mr-1">(${countdown}s)</span>` : ''}</button>` : ''
    }<button class="${CLOSE}" aria-label="${rtl ? 'סגור' : 'Close'}">${X}</button>${
        showCountdown && duration ? `<div class="absolute bottom-0 left-0 right-0 h-1 bg-black/10" data-slot="toast-progress"><div class="h-full bg-current opacity-30 transition-[width] duration-1000 ease-linear" style="width: ${percent}%"></div></div>` : ''
    }</div></ui-toast>`;
};
const el = ({ variant = 'default', heading = '', description = '', action = '', countdown = null, duration = null, loading = false, rtl = false } = {}) =>
    `<ge-toast${variant === 'default' ? '' : ` variant="${variant}"`}${heading ? ` heading="${heading}"` : ''}${description ? ` description="${description}"` : ''}${action ? ` action-label="${action}"` : ''}${countdown === null ? '' : ` show-countdown countdown-seconds="${countdown}"`}${duration ? ` duration="${duration}"` : ''}${loading ? ' loading' : ''}${rtl ? ' locale="he"' : ''}></ge-toast>`;

const W = 'width:380px;';
const one = (id, opts, focus) => ({ id, wrap: W, ref: ref(opts), el: el(opts), ...(focus ? { focus } : {}) });
const full = { heading: 'Scheduled: Catch up', description: 'Friday, February 10, 2023 at 5:57 PM' };
const items = [
    ...['default', 'destructive', 'success', 'info', 'warning'].map((variant) => one(variant, { variant, ...full })),
    one('heading-only', { heading: 'Saved' }),
    one('description-only', { description: 'Your changes were saved.' }),
    one('action', { ...full, action: 'Undo' }),
    one('action-destructive', { variant: 'destructive', ...full, action: 'Retry' }),
    one('countdown', { ...full, action: 'Undo', countdown: 3, duration: 5000 }),
    one('loading', { heading: 'Saving…', description: 'This may take a moment.', loading: true }),
    one('long', { heading: 'A heading that is long enough to wrap onto a second line in a narrow toast', description: 'And a description that also runs on for a while so that it wraps as well, keeping the close button clear.' }),
    one('rtl', { ...full, action: 'Undo', rtl: true }),
    one('focused-close', { ...full }, { ref: 'button[aria-label=Close]', el: 'ge-toast button.close' }),
    one('focused-action', { ...full, action: 'Undo' }, { ref: 'button:not([aria-label])', el: 'ge-toast button.action' }),
];
export default { name: 'toast', items };
