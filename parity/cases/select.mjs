// shadcn-angular select.component.ts and sub/*.component.ts (+ their density css).
const TRIGGER = 'border-input data-[placeholder]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex items-center justify-between rounded-md border bg-transparent text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4 dark:bg-input/50 dark:hover:bg-input/70';
const CHEVRON = '<svg class="size-4 opacity-50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"></path></svg>';
const CHECK = '<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>';
const ROW = 'focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4 ltr:pr-8 ltr:pl-2 rtl:pl-8 rtl:pr-2';
const PANEL = 'absolute z-50 max-h-96 min-w-[8rem] w-full max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md ltr:left-0 rtl:right-0';
// #233: the label and separator hosts are inline in shadcn-angular, so their padding and height never apply. Gil Elements
// draws them as blocks, and the reference is adapted the same way.
const LABEL = '<ui-select-label class="text-muted-foreground px-2 py-1.5 text-xs block" data-slot="select-label">Fruits</ui-select-label>';
const SEP = '<ui-select-separator class="bg-border pointer-events-none -mx-1 my-1 h-px block" data-slot="select-separator"></ui-select-separator>';

const RING = '<output class="inline-flex" aria-label="Loading" data-slot="spinner"><svg class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></output>';

const FRUITS = [['apple', 'Apple'], ['banana', 'Banana', true], ['blueberry', 'Blueberry'], ['grapes', 'Grapes']];
const rRow = ([value, text, disabled], selected, focused) =>
    `<ui-select-item class="${ROW}${disabled ? ' pointer-events-none opacity-50' : ''}${focused ? ' bg-accent text-accent-foreground' : ''}" role="option" aria-selected="${selected}" data-state="${selected ? 'checked' : 'unchecked'}"${disabled ? ' data-disabled="true" aria-disabled="true"' : ''} tabindex="-1" data-slot="select-item">${text}<span class="absolute flex size-3.5 items-center justify-center ltr:right-2 rtl:left-2">${selected ? CHECK : ''}</span></ui-select-item>`;
const rBody = (value) => `<ui-select-group class="p-1 contents" role="group">${LABEL}${FRUITS.map((f) => rRow(f, f[0] === value, f[0] === value)).join('')}${SEP}</ui-select-group>`;
const rSelect = ({ value, open, position = 'item-aligned', top, attrs = '', width = 'w-[200px]', disabled = false, extra = '' }) => {
    const side = position === 'popper' ? 'top-full mt-1' : 'top-0';
    const style = position === 'item-aligned' && top !== undefined ? ` style="top: ${top}px; margin-top: 0;"` : '';
    const shown = value ? `<span class="truncate">${value}</span>` : '<span class="text-muted-foreground truncate">Select a fruit</span>';
    return `<ui-select class="relative inline-block" data-slot="select" ${attrs}><ui-select-trigger class="contents"><button type="button" role="combobox" class="${TRIGGER} ${width}" ${disabled ? 'disabled' : ''} aria-expanded="${!!open}" data-state="${open ? 'open' : 'closed'}" aria-label="Select a fruit" data-slot="select-trigger">${extra || `<ui-select-value class="flex-1 truncate ltr:text-left rtl:text-right" data-slot="select-value">${shown}</ui-select-value>${CHEVRON}`}</button></ui-select-trigger><ui-select-content class="contents">${open ? `<div class="${PANEL} ${side}"${style} role="listbox" tabindex="-1" data-slot="select-content" data-position="${position}">${rBody(value)}</div>` : ''}</ui-select-content></ui-select>`;
};

const eRow = ([value, text, disabled]) => `<ge-select-item value="${value}"${disabled ? ' disabled' : ''}>${text}</ge-select-item>`;
const eSelect = ({ value, open, position = 'item-aligned', attrs = '', disabled = false, trigger = '' }) =>
    `<ge-select placeholder="Select a fruit" ${value ? `value="${value}"` : ''} position="${position}" ${disabled ? 'disabled' : ''} ${attrs}><ge-select-trigger style="width:200px" ${trigger} ${open ? 'data-open' : ''}><ge-select-value></ge-select-value></ge-select-trigger><ge-select-content><ge-select-group><ge-select-label>Fruits</ge-select-label>${FRUITS.map(eRow).join('')}<ge-select-separator></ge-select-separator></ge-select-group></ge-select-content></ge-select>`;

// The skeleton host is inline in shadcn-angular and the select is not a flex container, so its `h-9 w-full` never apply and
// nothing is drawn. Gil Elements draws the intended block; the reference is adapted with `block`, and the select gets the
// width a consumer would give it (an inline-block with only a `w-full` child is 0 wide).
const W = (extra = '') => `width:360px;height:300px;box-sizing:content-box;overflow:hidden;${extra}`;
const pad = (html) => `<div style="padding:70px 30px">${html}</div>`;
const tall = (html) => `<div style="padding:140px 30px 0">${html}</div>`;
const CHECKED = "ge-select-item[data-state='checked']";
const rtl = (html) => `<div dir="rtl">${html}</div>`;
const TRIGGER_DD = TRIGGER.replace('flex items-center', 'flex w-full items-center') + ' [&>span]:line-clamp-1';
const PANEL_DD = 'absolute z-50 max-h-60 min-w-[8rem] w-full max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border bg-popover p-0 text-popover-foreground shadow-md top-full mt-1 ltr:left-0 rtl:right-0';
const ddRow = ([value, text, disabled], selected) =>
    `<div role="option" tabindex="-1" class="relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 text-sm outline-none select-none ltr:pr-8 ltr:pl-2 rtl:pl-8 rtl:pr-2 ${disabled ? 'text-muted-foreground cursor-not-allowed opacity-50' : `hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground${selected ? ' bg-accent text-accent-foreground' : ''}`}" aria-selected="${selected}" data-state="${selected ? 'checked' : 'unchecked'}" data-slot="select-option"><span class="flex-1">${text}</span><span class="absolute flex size-3.5 items-center justify-center ltr:right-2 rtl:left-2">${selected ? CHECK : ''}</span></div>`;
const rData = ({ value, open, disabled }) =>
    `<ui-select class="relative inline-block" style="width:200px" data-slot="select"><div class="relative inline-block w-full"><button type="button" role="combobox" class="${TRIGGER_DD}" ${disabled ? 'disabled' : ''} aria-expanded="${!!open}" aria-label="Select a fruit" data-state="${open ? 'open' : 'closed'}" data-slot="select-trigger"><span class="flex-1 truncate ltr:text-left rtl:text-right">${value ? value : '<span class="text-muted-foreground">Select a fruit</span>'}</span>${CHEVRON}</button>${open ? `<div class="${PANEL_DD}" role="listbox" tabindex="-1"><div class="p-1">${FRUITS.map((f) => ddRow(f, f[1] === value)).join('')}</div></div>` : ''}</div></ui-select>`;
const eData = ({ value, open, disabled }) =>
    `<ge-select style="width:200px" placeholder="Select a fruit" ${value ? `value="${value}"` : ''} ${disabled ? 'disabled' : ''} data-options='${JSON.stringify(FRUITS.map((f) => f[1]))}' data-disabled-options='["Banana"]' ${open ? 'data-open' : ''}></ge-select>`;

const items = [
    { id: 'placeholder', wrap: W(), ref: pad(rSelect({})), el: pad(eSelect({})) },
    { id: 'value', wrap: W(), ref: pad(rSelect({ value: 'blueberry' })), el: pad(eSelect({ value: 'blueberry' })) },
    { id: 'disabled', wrap: W(), ref: pad(rSelect({ disabled: true })), el: pad(eSelect({ disabled: true })) },
    { id: 'item-aligned', wrap: W('height:360px;'), focus: { el: CHECKED }, ref: tall(rSelect({ value: 'blueberry', open: true, top: -100 })), el: tall(eSelect({ value: 'blueberry', open: true })) },
    { id: 'popper', wrap: W(), focus: { el: CHECKED }, ref: pad(rSelect({ value: 'blueberry', open: true, position: 'popper' })), el: pad(eSelect({ value: 'blueberry', open: true, position: 'popper' })) },
    { id: 'popper-none-selected', wrap: W(), ref: pad(rSelect({ open: true, position: 'popper' })), el: pad(eSelect({ open: true, position: 'popper' })) },
    { id: 'density-1.5', wrap: W('--density:1.5;height:420px;'), focus: { el: CHECKED }, ref: tall(rSelect({ value: 'blueberry', open: true, top: -132 })), el: tall(eSelect({ value: 'blueberry', open: true })) },
    { id: 'rtl-popper', wrap: W(), focus: { el: CHECKED }, ref: rtl(pad(rSelect({ value: 'grapes', open: true, position: 'popper' }))), el: rtl(pad(eSelect({ value: 'grapes', open: true, position: 'popper' }))) },
    { id: 'rtl-item-aligned', wrap: W('height:360px;'), focus: { el: CHECKED }, ref: rtl(tall(rSelect({ value: 'blueberry', open: true, top: -100 }))), el: rtl(tall(eSelect({ value: 'blueberry', open: true }))) },
    {
        id: 'loading', wrap: W(),
        ref: pad(rSelect({ extra: '<ui-select-value class="flex-1 truncate ltr:text-left rtl:text-right" data-slot="select-value"><span class="text-muted-foreground truncate">Select a fruit</span></ui-select-value>' + RING, disabled: true })),
        el: pad(eSelect({ trigger: 'loading' })),
    },
    {
        id: 'skeleton', wrap: W(),
        ref: pad('<ui-select class="relative inline-block w-[200px]" data-slot="select"><ui-select-trigger class="contents"><ui-skeleton class="h-9 w-full rounded-md animate-pulse bg-primary/10 block" data-slot="skeleton"></ui-skeleton></ui-select-trigger></ui-select>'),
        el: pad('<ge-select style="width:200px"><ge-select-trigger skeleton><ge-select-value></ge-select-value></ge-select-trigger></ge-select>'),
    },
];
items.push(
    { id: 'options-placeholder', wrap: W(), ref: pad(rData({})), el: pad(eData({})) },
    { id: 'options-open', wrap: W(), focus: { el: CHECKED }, ref: pad(rData({ value: 'Blueberry', open: true })), el: pad(eData({ value: 'Blueberry', open: true })) },
    { id: 'options-open-none', wrap: W(), ref: pad(rData({ open: true })), el: pad(eData({ open: true })) },
    { id: 'options-disabled', wrap: W(), ref: pad(rData({ value: 'Apple', disabled: true })), el: pad(eData({ value: 'Apple', disabled: true })) },
);
export default { name: 'select', isolated: true, items };
