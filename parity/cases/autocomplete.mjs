// shadcn-angular autocomplete.component.html/.css, closed: the open list is promoted to the top layer, which static
// markup cannot show; command.mjs covers the rows and autocomplete.browser.test.ts the highlight and the check mark.
const BOX = 'flex w-full items-center justify-between rounded-md border border-input bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2';
const SINGLE_INPUT = 'flex-1 bg-transparent p-0 placeholder:text-muted-foreground outline-none text-sm w-full';
const MULTI_INPUT = 'flex-1 bg-transparent p-0 placeholder:text-muted-foreground outline-none min-w-[60px]';
const CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 opacity-50 shrink-0"><path d="m6 9 6 6 6-6"/></svg>';
const X = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
const BADGE = 'inline-flex items-center rounded-md border text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 gap-1 pe-0.5';
const REMOVE = 'cursor-pointer rounded-full p-0.5 pointer-coarse:size-11 hover:bg-secondary-foreground/20 inline-flex items-center justify-center bg-transparent border-0';

const attrs = (disabled) => `type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="autocomplete-list-1" ${disabled ? 'disabled' : ''}`;
const ref = ({ multiple = false, chips = [], value = '', placeholder = 'Select...', disabled = false, dir = '' }) => {
    const cursor = disabled ? 'cursor-not-allowed opacity-50' : 'cursor-text';
    const inner = multiple
        ? `<div class="flex flex-wrap items-center gap-1 w-full">${chips.map((c) => `<ui-badge variant="secondary" data-slot="badge" class="${BADGE}">${c}<button type="button" class="${REMOVE}" data-slot="chip-remove">${X}</button></ui-badge>`).join('')}<input ${attrs(disabled)} class="${MULTI_INPUT}${disabled ? ' cursor-not-allowed' : ''}" placeholder="${chips.length === 0 ? placeholder : ''}"></div>`
        : `<div class="flex items-center w-full gap-2"><input ${attrs(disabled)} class="${SINGLE_INPUT}${disabled ? ' cursor-not-allowed' : ''}" placeholder="${placeholder}" value="${value}">${CHEVRON}</div>`;
    return `<ui-autocomplete class="contents"><ui-popover class="relative inline-block" data-slot="popover"><ui-popover-trigger class="contents"><span class="w-full" data-slot="popover-trigger"><div class="${BOX} ${cursor}" data-state="closed" ${disabled ? 'data-disabled="true"' : ''} data-slot="autocomplete-container" ${dir ? `dir="${dir}"` : ''} tabindex="-1">${inner}</div></span></ui-popover-trigger></ui-popover></ui-autocomplete>`;
};
const FRUIT = '["Apple","Apricot","Banana","Cherry"]';
const el = (attrs = '', data = '') => `<ge-autocomplete data-options='${FRUIT}' ${data} ${attrs}></ge-autocomplete>`;

export default {
    name: 'autocomplete',
    items: [
        { id: 'placeholder', ref: ref({}), el: el() },
        { id: 'custom-placeholder', ref: ref({ placeholder: 'Pick a fruit' }), el: el('placeholder="Pick a fruit"') },
        { id: 'value', ref: ref({ value: 'Banana' }), el: el('', `data-value='"Banana"'`) },
        { id: 'disabled', ref: ref({ disabled: true }), el: el('disabled') },
        { id: 'density-1.5', wrap: '--density:1.5;', ref: ref({}), el: el() },
        { id: 'rtl', ref: `<div dir="rtl">${ref({ placeholder: '...בחר', dir: 'rtl' })}</div>`, el: `<div dir="rtl">${el('locale="he"')}</div>` },
        { id: 'multiple-empty', ref: ref({ multiple: true }), el: el('multiple') },
        { id: 'multiple-chips', ref: ref({ multiple: true, chips: ['Apple', 'Cherry'] }), el: el('multiple', `data-value='["Apple","Cherry"]'`) },
        { id: 'multiple-disabled', ref: ref({ multiple: true, chips: ['Apple'], disabled: true }), el: el('multiple disabled', `data-value='["Apple"]'`) },
        { id: 'multiple-density-1.5', wrap: '--density:1.5;', ref: ref({ multiple: true, chips: ['Apple', 'Cherry'] }), el: el('multiple', `data-value='["Apple","Cherry"]'`) },
    ],
};
