// shadcn-angular input.component.ts (inputVariants, classes, containerClasses, innerClasses, floatingLabelClasses) and .html.
// cn() is tailwind-merge over cva: where a variant repeats a base utility the later one wins.
const BASE = 'border-input aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-transparent text-base transition-colors md:text-sm placeholder:text-muted-foreground w-full min-w-0 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50';
const VARIANT = {
    outline: 'dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 rounded-lg border focus-visible:ring-[3px] aria-invalid:ring-[3px]',
    underline: 'rounded-none border-b focus-visible:border-ring px-0 shadow-none',
    ghost: 'border-none shadow-none focus-visible:ring-0 px-0',
};
const CONTAINER = 'relative flex w-full items-center rounded-lg border border-input shadow-xs transition-[color,box-shadow] has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50 dark:bg-input/30 bg-transparent';
const DISABLED_CONTAINER = 'opacity-50 pointer-events-none cursor-not-allowed';
const AFFIX = 'text-muted-foreground flex shrink-0 items-center text-sm select-none';
const X = '<ui-icon class="size-3.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ui-icon ui-icon-x size-3.5" data-slot="icon"><path d="m6 6 12 12" /><path d="M18 6 6 18" /></svg></ui-icon>';
const RING = '<output class="inline-flex" aria-label="Loading" data-slot="spinner"><svg class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></output>';

const attrs = ({ type = 'text', placeholder = '', value = '', disabled = false }) =>
    `type="${type}" placeholder="${placeholder}" ${value ? `value="${value}"` : ''} ${disabled ? 'disabled' : ''}`;
const refPlain = (variant, p) => `<ui-input class="contents"><input class="${BASE} ${VARIANT[variant]}" ${attrs(p)} data-slot="input"></ui-input>`;
const refContainer = (p, { prefix, suffix, clearable, loading }) =>
    `<ui-input class="contents"><div class="${CONTAINER}${p.disabled ? ` ${DISABLED_CONTAINER}` : ''}" data-slot="input-container">` +
    (prefix ? `<span class="${AFFIX} ps-3 pe-1">${prefix}</span>` : '') +
    // Adjusted reference: shadcn-angular leaves the inner field flush when there is no prefix; we pad it (agreed with Gil, gilav21/shadcn-angular#215).
    `<input class="${BASE} ${VARIANT.ghost} flex-1 h-full${prefix ? '' : ' ps-[calc(0.75rem*var(--\\_d))]'}" ${attrs(p)} data-slot="input">` +
    (clearable && p.value
        ? `<button type="button" tabindex="-1" class="flex shrink-0 items-center justify-center pe-2 text-muted-foreground hover:text-foreground" aria-label="Clear">${X}</button>`
        : '') +
    (loading ? `<div class="flex shrink-0 items-center pe-2 pointer-events-none">${RING}</div>` : '') +
    (suffix && !loading ? `<span class="${AFFIX} ps-1 pe-3">${suffix}</span>` : '') +
    '</div></ui-input>';
const refFloating = (variant, p, label, active) =>
    `<ui-input class="contents"><div class="relative" data-slot="input-floating" data-variant="${variant}"><input class="${BASE} ${VARIANT[variant]}" ${attrs({ ...p, placeholder: active ? p.placeholder : '' })} id="f" data-slot="input">` +
    `<label for="f" class="pointer-events-none absolute select-none text-muted-foreground transition-all duration-150 ${active ? 'text-xs' : 'text-sm'}" ${active ? 'data-active' : ''}>${label}</label></div></ui-input>`;

const bool = (name, on) => (on ? ` ${name}` : '');
const el = (p, extra = '') =>
    `<ge-input${p.variant && p.variant !== 'outline' ? ` variant="${p.variant}"` : ''}${p.type && p.type !== 'text' ? ` type="${p.type}"` : ''}${p.placeholder ? ` placeholder="${p.placeholder}"` : ''}${p.value ? ` value="${p.value}"` : ''}${bool('disabled', p.disabled)}${extra}></ge-input>`;

const W = 'width:16rem;';
const FOCUS = { ref: 'input', el: 'input' };
const items = [];
for (const variant of ['outline', 'underline', 'ghost']) {
    items.push(
        { id: `${variant}-placeholder`, wrap: W, ref: refPlain(variant, { placeholder: 'you@example.com' }), el: el({ variant, placeholder: 'you@example.com' }) },
        { id: `${variant}-value`, wrap: W, ref: refPlain(variant, { value: 'Gil Avraham' }), el: el({ variant, value: 'Gil Avraham' }) },
        { id: `${variant}-disabled`, wrap: W, ref: refPlain(variant, { value: 'Locked', disabled: true }), el: el({ variant, value: 'Locked', disabled: true }) },
        { id: `${variant}-focus`, wrap: W, focus: FOCUS, ref: refPlain(variant, { value: 'Gil Avraham' }), el: el({ variant, value: 'Gil Avraham' }) },
        { id: `${variant}-floating-resting`, wrap: W, ref: refFloating(variant, { placeholder: 'you@example.com' }, 'Email', false), el: el({ variant, placeholder: 'you@example.com' }, ' floating label="Email"') },
        { id: `${variant}-floating-filled`, wrap: W, ref: refFloating(variant, { value: 'gil@example.com', placeholder: 'you@example.com' }, 'Email', true), el: el({ variant, value: 'gil@example.com', placeholder: 'you@example.com' }, ' floating label="Email"') },
        { id: `${variant}-floating-focus`, wrap: W, focus: FOCUS, ref: refFloating(variant, { placeholder: 'you@example.com' }, 'Email', true), el: el({ variant, placeholder: 'you@example.com' }, ' floating label="Email"') },
    );
}
items.push(
    { id: 'password', wrap: W, ref: refPlain('outline', { type: 'password', value: 'secret' }), el: el({ type: 'password', value: 'secret' }) },
    { id: 'prefix', wrap: W, ref: refContainer({ placeholder: '0.00' }, { prefix: '$' }), el: el({ placeholder: '0.00' }, ' prefix="$"') },
    { id: 'suffix', wrap: W, ref: refContainer({ placeholder: 'weight' }, { suffix: 'kg' }), el: el({ placeholder: 'weight' }, ' suffix="kg"') },
    { id: 'prefix-suffix', wrap: W, ref: refContainer({ value: 'example' }, { prefix: 'https://', suffix: '.com' }), el: el({ value: 'example' }, ' prefix="https://" suffix=".com"') },
    { id: 'clearable-filled', wrap: W, ref: refContainer({ value: 'Gil' }, { clearable: true }), el: el({ value: 'Gil' }, ' clearable') },
    { id: 'clearable-empty', wrap: W, ref: refContainer({ placeholder: 'Search' }, { clearable: true }), el: el({ placeholder: 'Search' }, ' clearable') },
    { id: 'loading', at: 700, wrap: W, ref: refContainer({ value: 'query' }, { loading: true }), el: el({ value: 'query' }, ' loading') },
    { id: 'loading-hides-suffix', at: 700, wrap: W, ref: refContainer({ value: 'query' }, { loading: true, suffix: 'kg' }), el: el({ value: 'query' }, ' loading suffix="kg"') },
    { id: 'container-disabled', wrap: W, ref: refContainer({ value: 'Locked', disabled: true }, { prefix: '$' }), el: el({ value: 'Locked', disabled: true }, ' prefix="$"') },
    { id: 'container-focus', wrap: W, focus: FOCUS, ref: refContainer({ value: 'Gil' }, { prefix: '$', suffix: 'kg' }), el: el({ value: 'Gil' }, ' prefix="$" suffix="kg"') },
    // A bare <ui-skeleton> is an inline box in block flow and collapses; a flex parent makes it the visible 2.25rem bar.
    { id: 'skeleton', at: 700, wrap: `${W}display:flex`, ref: '<ui-input class="contents"><ui-skeleton class="rounded-md animate-pulse bg-primary/10 h-9 w-full rounded-md"></ui-skeleton></ui-input>', el: '<ge-input skeleton></ge-input>' },
    { id: 'density-0.75', wrap: `${W}--density:0.75;`, ref: refPlain('outline', { value: 'Gil Avraham' }), el: el({ value: 'Gil Avraham' }) },
    { id: 'density-1.25-floating', wrap: `${W}--density:1.25;`, ref: refFloating('outline', { value: 'gil@example.com' }, 'Email', true), el: el({ value: 'gil@example.com' }, ' floating label="Email"') },
);
export default { name: 'input', items };
