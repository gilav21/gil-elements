// shadcn-angular native-select.component.ts (classes) and .html, with the horizontal padding utilities dropped as proposed in gilav21/shadcn-angular#235 so the stylesheet's density padding applies.
const SELECT = 'border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground w-full min-w-0 appearance-none rounded-md border bg-transparent text-sm shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';
const INVALID = ' ring-destructive/20 border-destructive';
const CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground pointer-events-none absolute top-1/2 ltr:right-3.5 rtl:left-3.5 size-4 -translate-y-1/2 opacity-50 select-none" aria-hidden="true" data-slot="native-select-icon"><path d="m6 9 6 6 6-6"/></svg>';
const FRUIT = '<option value="">Select a fruit</option><option value="apple">Apple</option><option value="banana">Banana</option><option value="blueberry">Blueberry</option>';
const GROUPED = '<option value="">Select a fruit</option><optgroup label="Citrus"><option value="orange">Orange</option><option value="lemon" disabled>Lemon</option></optgroup><optgroup label="Berries"><option value="blueberry">Blueberry</option></optgroup>';
const ref = ({ options = FRUIT, value = '', size = 'default', disabled = false, invalid = false } = {}) => {
    const body = value ? options.replace(`value="${value}"`, `value="${value}" selected`) : options;
    return `<ui-native-select class="contents"><div class="group/native-select relative w-fit${disabled ? ' opacity-50' : ''}" data-slot="native-select-wrapper"><select class="${invalid ? SELECT.replace('border-input ', '') + INVALID : SELECT}" data-slot="native-select" data-size="${size}" aria-label="Fruit"${disabled ? ' disabled' : ''}${invalid ? ' aria-invalid="true"' : ''}>${body}</select>${CHEVRON}</div></ui-native-select>`;
};
const el = ({ options = FRUIT, value = '', size = '', disabled = false, invalid = false } = {}) =>
    `<ge-native-select aria-label="Fruit"${value ? ` value="${value}"` : ''}${size ? ` size="${size}"` : ''}${disabled ? ' disabled' : ''}${invalid ? ' invalid' : ''}>${options}</ge-native-select>`;
const W = 'width:16rem;';
const rtl = (html) => `<div dir="rtl">${html}</div>`;
export default {
    name: 'native-select',
    items: [
        { id: 'default', wrap: W, ref: ref(), el: el() },
        { id: 'value', wrap: W, ref: ref({ value: 'banana' }), el: el({ value: 'banana' }) },
        { id: 'small', wrap: W, ref: ref({ size: 'sm', value: 'apple' }), el: el({ size: 'sm', value: 'apple' }) },
        { id: 'groups', wrap: W, ref: ref({ options: GROUPED, value: 'orange' }), el: el({ options: GROUPED, value: 'orange' }) },
        { id: 'disabled', wrap: W, ref: ref({ disabled: true, value: 'apple' }), el: el({ disabled: true, value: 'apple' }) },
        { id: 'invalid', wrap: W, ref: ref({ invalid: true, value: 'apple' }), el: el({ invalid: true, value: 'apple' }) },
        { id: 'density-1.25', wrap: `${W}--density:1.25;`, ref: ref({ value: 'apple' }), el: el({ value: 'apple' }) },
        { id: 'density-0.75-small', wrap: `${W}--density:0.75;`, ref: ref({ size: 'sm', value: 'apple' }), el: el({ size: 'sm', value: 'apple' }) },
        { id: 'rtl', wrap: W, ref: rtl(ref({ value: 'banana' })), el: rtl(el({ value: 'banana' })) },
    ],
};
