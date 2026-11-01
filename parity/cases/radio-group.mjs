// shadcn-angular radio-group.component.html and sub/radio-group-item.component.html/.ts.
const CIRCLE = 'aspect-square rounded-full border border-primary text-primary shadow outline-none peer-focus-visible:ring-1 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50 flex items-center justify-center';
const INPUT = 'peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed';

const circle = (checked) =>
    `<span class="${CIRCLE} ${checked ? '' : 'bg-background'}" data-state="${checked ? 'checked' : 'unchecked'}" data-slot="radio-group-item" aria-hidden="true">${checked ? '<span class="flex items-center justify-center"><span class="rounded-full bg-current"></span></span>' : ''}</span>`;

let n = 0;
const refItem = ({ value, label, checked, disabled }) => {
    const id = `r${++n}`;
    const input = (extra) => `<input type="radio" class="${INPUT}" id="${id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} ${extra}>`;
    if (!label) return `<ui-radio-group-item class="contents"><span class="relative inline-flex shrink-0">${input(`aria-label="${value}"`)}${circle(checked)}</span></ui-radio-group-item>`;
    const labelClass = `text-sm font-medium leading-none ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`;
    return `<ui-radio-group-item class="contents"><div class="flex items-center gap-2"><span class="relative inline-flex shrink-0">${input(`aria-labelledby="${id}-label"`)}${circle(checked)}</span><label id="${id}-label" for="${id}" class="${labelClass}"> ${label} </label></div></ui-radio-group-item>`;
};
const refGroup = (items, { selected, horizontal = false, disabled = false } = {}) =>
    `<ui-radio-group class="contents"><div role="radiogroup" class="grid gap-2 ${horizontal ? 'grid-flow-col' : 'grid-flow-row'}" data-slot="radio-group">${items
        .map((item) => refItem({ ...item, checked: item.value === selected, disabled: disabled || item.disabled }))
        .join('')}</div></ui-radio-group>`;
const elGroup = (items, { selected, horizontal = false, disabled = false } = {}) =>
    `<ge-radio-group${selected ? ` value="${selected}"` : ''}${horizontal ? ' orientation="horizontal"' : ''}${disabled ? ' disabled' : ''}>${items
        .map((item) => `<ge-radio-group-item value="${item.value}"${item.label ? ` label="${item.label}"` : ` aria-label="${item.value}"`}${item.disabled ? ' disabled' : ''}></ge-radio-group-item>`)
        .join('')}</ge-radio-group>`;

const bare = [{ value: 'a' }, { value: 'b' }, { value: 'c' }];
const labelled = [{ value: 'default', label: 'Default' }, { value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }];
const mixed = [{ value: 'default', label: 'Default' }, { value: 'comfortable', label: 'Comfortable', disabled: true }, { value: 'compact', label: 'Compact' }];

const pair = (id, items, opts, extra = {}) => ({ id, ref: refGroup(items, opts), el: elGroup(items, opts), ...extra });
const focus = { ref: 'input', el: 'ge-radio-group-item' };
export default {
    name: 'radio-group',
    items: [
        pair('bare-none', bare, {}),
        pair('bare-selected', bare, { selected: 'b' }),
        pair('labelled-none', labelled, {}),
        pair('labelled-selected', labelled, { selected: 'comfortable' }),
        pair('labelled-horizontal', labelled, { selected: 'default', horizontal: true }),
        pair('bare-horizontal', bare, { selected: 'c', horizontal: true }),
        pair('item-disabled', mixed, { selected: 'default' }),
        pair('item-disabled-selected', mixed, { selected: 'comfortable' }),
        pair('group-disabled', labelled, { selected: 'compact', disabled: true }),
        pair('group-disabled-bare', bare, { selected: 'a', disabled: true }),
        pair('focus-selected', labelled, { selected: 'default' }, { focus }),
        pair('focus-bare', bare, { selected: 'a' }, { focus }),
        { id: 'rtl-labelled', ref: `<div dir="rtl">${refGroup(labelled, { selected: 'default' })}</div>`, el: `<div dir="rtl">${elGroup(labelled, { selected: 'default' })}</div>` },
        pair('density-1.5', labelled, { selected: 'default' }, { wrap: '--density:1.5;' }),
        pair('density-0.75', bare, { selected: 'b' }, { wrap: '--density:0.75;' }),
    ],
};
