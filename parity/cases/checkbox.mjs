// shadcn-angular checkbox.component.html and .ts (classes()).
const BOX = 'shrink-0 rounded-sm border border-primary shadow outline-none peer-focus-visible:ring-1 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50 flex items-center justify-center';
const ON = 'bg-primary text-primary-foreground';
const OFF = 'bg-background';
const CHECK = '<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>';
const DASH = '<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14" /></svg>';
const INPUT = 'peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed';

const ref = ({ checked = false, indeterminate = false, disabled = false, label = '' } = {}) => {
    const on = checked || indeterminate;
    const glyph = indeterminate ? DASH : checked ? CHECK : '';
    const control = `<span class="relative inline-flex shrink-0"><input type="checkbox" class="${INPUT}" id="c" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span class="${BOX} ${on ? ON : OFF}" data-slot="checkbox" aria-hidden="true">${glyph}</span></span>`;
    const text = label
        ? `<label for="c" class="text-sm font-medium leading-none ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}">${label}</label>`
        : '';
    return `<ui-checkbox class="contents"><div class="${label ? 'flex items-center gap-2' : 'contents'}">${control}${text}</div></ui-checkbox>`;
};
const el = ({ checked = false, indeterminate = false, disabled = false, label = '' } = {}) =>
    `<ge-checkbox${checked ? ' checked' : ''}${indeterminate ? ' indeterminate' : ''}${disabled ? ' disabled' : ''}${label ? ` label="${label}"` : ''}></ge-checkbox>`;

const states = {
    unchecked: {},
    checked: { checked: true },
    indeterminate: { indeterminate: true },
    'disabled-unchecked': { disabled: true },
    'disabled-checked': { disabled: true, checked: true },
};
const items = [];
for (const [id, props] of Object.entries(states)) {
    items.push({ id, ref: ref(props), el: el(props) });
    items.push({ id: `${id}-label`, ref: ref({ ...props, label: 'Accept terms' }), el: el({ ...props, label: 'Accept terms' }) });
}
items.push(
    { id: 'focus-unchecked', focus: { ref: 'input', el: 'ge-checkbox' }, ref: ref(), el: el() },
    { id: 'focus-checked-label', focus: { ref: 'input', el: 'ge-checkbox' }, ref: ref({ checked: true, label: 'Accept terms' }), el: el({ checked: true, label: 'Accept terms' }) },
    // In block flow Angular's bare <ui-skeleton> is an inline box and collapses to nothing; a flex parent makes it a visible 1rem square.
    { id: 'skeleton', at: 700, wrap: 'display:flex', ref: '<ui-checkbox class="contents"><ui-skeleton class="rounded-md animate-pulse bg-primary/10 h-4 w-4 rounded-sm"></ui-skeleton></ui-checkbox>', el: '<ge-checkbox skeleton></ge-checkbox>' },
    {
        id: 'skeleton-label',
        at: 700,
        ref: '<ui-checkbox class="contents"><div class="flex items-center gap-2"><ui-skeleton class="rounded-md animate-pulse bg-primary/10 h-4 w-4 rounded-sm"></ui-skeleton><ui-skeleton class="rounded-md animate-pulse bg-primary/10 h-4 w-20 rounded-md"></ui-skeleton></div></ui-checkbox>',
        el: '<ge-checkbox skeleton label="Accept terms"></ge-checkbox>',
    },
    { id: 'density-1.5', wrap: '--density:1.5;', ref: ref({ checked: true }), el: el({ checked: true }) },
);
export default { name: 'checkbox', items };
