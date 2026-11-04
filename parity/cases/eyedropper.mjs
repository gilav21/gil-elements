// shadcn-angular eyedropper.component.html and .ts (classes), with the pipette from ui-icon.
const BASE = 'inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const PIPETTE = '<ui-icon class="h-4 w-4"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ui-icon ui-icon-pipette h-4 w-4" data-slot="icon"><path d="m16 3 5 5-2 2-5-5z" /><path d="m14 9-9 9v3h3l9-9" /></svg></ui-icon>';

const ref = ({ variant = 'icon', label = 'Pick color', disabled = false, picking = false, dir = 'ltr', title = label }) =>
    `<ui-eyedropper class="inline-block"><button type="button" class="${BASE} ${variant === 'icon' ? 'h-9 w-9' : 'h-9 px-3'}${picking ? ' ring-2 ring-ring' : ''}" ${disabled ? 'disabled' : ''} aria-label="${label}" aria-pressed="${picking}" title="${title}" dir="${dir}" data-slot="eyedropper-trigger">${PIPETTE}${variant === 'button' ? `<span>${label}</span>` : ''}</button></ui-eyedropper>`;
// The headless browser has no native EyeDropper, so a case that should be enabled gets a fallback target (`data-fallback`); one without it shows the unsupported state.
const el = ({ variant = 'icon', label, disabled = false, picking = false, locale, unsupported = false }) =>
    `<ge-eyedropper${variant === 'icon' ? '' : ` variant="${variant}"`}${label ? ` label="${label}"` : ''}${disabled ? ' disabled' : ''}${picking ? ' data-picking' : ''}${locale ? ` locale="${locale}"` : ''}${unsupported ? '' : ' data-fallback'}></ge-eyedropper>`;

const items = [];
for (const variant of ['icon', 'button']) {
    items.push(
        { id: `${variant}`, ref: ref({ variant }), el: el({ variant }) },
        { id: `${variant}-disabled`, ref: ref({ variant, disabled: true }), el: el({ variant, disabled: true }) },
        { id: `${variant}-picking`, ref: ref({ variant, picking: true }), el: el({ variant, picking: true }) },
        { id: `${variant}-unsupported`, ref: ref({ variant, disabled: true, title: 'Eyedropper not supported in this browser' }), el: el({ variant, unsupported: true }) },
        { id: `${variant}-focus`, focus: { ref: 'button', el: 'button' }, ref: ref({ variant }), el: el({ variant }) },
    );
}
items.push(
    { id: 'custom-label', ref: ref({ variant: 'button', label: 'Pick pixel' }), el: el({ variant: 'button', label: 'Pick pixel' }) },
    { id: 'rtl', ref: ref({ variant: 'button', label: 'בחר צבע', dir: 'rtl' }), el: el({ variant: 'button', locale: 'he' }) },
);
export default { name: 'eyedropper', items };
