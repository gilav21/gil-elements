// shadcn-angular switch.component.html and .ts (trackClasses, thumbClasses).
const TRACK = 'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';
const THUMB = 'pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform';
const LABEL = 'text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70';

const ref = ({ checked = false, disabled = false, label = '' } = {}) => {
    const button = `<button type="button" role="switch" aria-checked="${checked}" class="${TRACK} ${checked ? 'bg-primary' : 'bg-input'}" ${disabled ? 'disabled' : ''} data-slot="switch" id="s" aria-label="${label ? '' : 'Switch'}"><span class="${THUMB}"></span></button>`;
    const control = label ? `<div class="flex items-center gap-2">${button.replace(' aria-label=""', '')}<label for="s" class="${LABEL}"> ${label} </label></div>` : button;
    return `<ui-switch class="contents">${control}</ui-switch>`;
};
const el = ({ checked = false, disabled = false, label = '' } = {}) =>
    `<ge-switch${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}${label ? ` label="${label}"` : ' aria-label="Switch"'}></ge-switch>`;

const states = { off: {}, on: { checked: true }, 'disabled-off': { disabled: true }, 'disabled-on': { disabled: true, checked: true } };
const items = [];
for (const [id, props] of Object.entries(states)) {
    items.push({ id, ref: ref(props), el: el(props) });
    items.push({ id: `${id}-label`, ref: ref({ ...props, label: 'Airplane mode' }), el: el({ ...props, label: 'Airplane mode' }) });
}
const focus = { ref: 'button', el: 'ge-switch' };
items.push(
    { id: 'focus-off', focus, ref: ref(), el: el() },
    { id: 'focus-on-label', focus, ref: ref({ checked: true, label: 'Airplane mode' }), el: el({ checked: true, label: 'Airplane mode' }) },
    { id: 'rtl-on', ref: `<div dir="rtl">${ref({ checked: true })}</div>`, el: `<div dir="rtl">${el({ checked: true })}</div>` },
    { id: 'rtl-on-label', ref: `<div dir="rtl">${ref({ checked: true, label: 'Airplane mode' })}</div>`, el: `<div dir="rtl">${el({ checked: true, label: 'Airplane mode' })}</div>` },
    // A bare <ui-skeleton> collapses in block flow; a flex parent makes it the visible pill.
    { id: 'skeleton', at: 700, wrap: 'display:flex', ref: '<ui-switch class="contents"><ui-skeleton class="animate-pulse bg-primary/10 h-5 w-9 rounded-full"></ui-skeleton></ui-switch>', el: '<ge-switch skeleton></ge-switch>' },
    {
        id: 'skeleton-label',
        at: 700,
        ref: '<ui-switch class="contents"><div class="flex items-center gap-2"><ui-skeleton class="animate-pulse bg-primary/10 h-5 w-9 rounded-full"></ui-skeleton><ui-skeleton class="rounded-md animate-pulse bg-primary/10 h-4 w-20 rounded-md"></ui-skeleton></div></ui-switch>',
        el: '<ge-switch skeleton label="Airplane mode"></ge-switch>',
    },
    { id: 'density-1.5', wrap: '--density:1.5;', ref: ref({ checked: true }), el: el({ checked: true }) },
    { id: 'density-0.75', wrap: '--density:0.75;', ref: ref(), el: el() },
);
export default { name: 'switch', items };
