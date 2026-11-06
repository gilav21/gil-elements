// shadcn-angular currency-input.component: the number input's wrapper (rounded-lg border, ring on focus-within) around a ghost ui-input with px-3,
// here a text field with inputmode decimal. At rest it shows the locale's formatted amount; the references carry that text as the field's value.
const WRAP_BASE = 'relative flex items-center border-input bg-transparent transition-colors focus-within:border-ring aria-disabled:pointer-events-none aria-disabled:opacity-50';
const WRAP = {
    outline: `${WRAP_BASE} focus-within:ring-ring/50 focus-within:ring-[3px] dark:bg-input/30 rounded-lg border`,
    underline: `${WRAP_BASE} rounded-none border-b border-t-0 border-x-0 focus-within:ring-0 shadow-none`,
    ghost: `${WRAP_BASE} border-none shadow-none focus-within:ring-0`,
};
const INNER = 'border-input aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-transparent text-base transition-colors md:text-sm placeholder:text-muted-foreground w-full min-w-0 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 border-none shadow-none focus-visible:ring-0 px-3';

const ref = ({ variant = 'outline', text = '', placeholder = '', disabled = false, lang = 'en' } = {}) =>
    `<ui-currency-input class="contents"><div class="${WRAP[variant]}" data-slot="currency-input" data-variant="${variant}" ${disabled ? 'aria-disabled="true"' : ''}><ui-input class="contents"><input class="${INNER}" type="text" inputmode="decimal" lang="${lang}" aria-label="Amount" placeholder="${placeholder}" ${text === '' ? '' : `value="${text}"`} ${disabled ? 'disabled' : ''} data-slot="input"></ui-input></div></ui-currency-input>`;
const el = ({ variant = 'outline', value = '', placeholder = '', disabled = false, locale = 'en', currency = 'USD' } = {}) =>
    `<ge-currency-input locale="${locale}" currency="${currency}"${variant === 'outline' ? '' : ` variant="${variant}"`}${value === '' ? '' : ` value="${value}"`}${placeholder === '' ? '' : ` placeholder="${placeholder}"`}${disabled ? ' disabled' : ''}></ge-currency-input>`;

const W = 'width:14rem;';
const pair = (id, props, text, extra = {}) => ({ id, wrap: W + (extra.wrap ?? ''), ref: ref({ ...props, text }), el: el(props), ...(extra.focus ? { focus: extra.focus } : {}) });
const items = [];
for (const variant of ['outline', 'underline', 'ghost']) {
    items.push(pair(`${variant}-empty`, { variant, placeholder: '$0.00' }, ''), pair(`${variant}-value`, { variant, value: '12345.6' }, '$12,345.60'));
}
items.push(
    pair('disabled', { value: '12345.6', disabled: true }, '$12,345.60'),
    pair('focus', { value: '12345.6' }, '12345.6', { focus: { ref: 'input', el: 'input' } }),
    pair('euro-de', { value: '12345.6', locale: 'de', currency: 'EUR' }, '12.345,60 €', { }),
    pair('yen-no-decimals', { value: '12345.6', locale: 'ja', currency: 'JPY' }, '￥12,346'),
    pair('density-1.5', { value: '12345.6' }, '$12,345.60', { wrap: '--density:1.5;' }),
);
for (const item of items) if (item.id === 'euro-de') item.ref = item.ref.replace('lang="en"', 'lang="de"');
for (const item of items) if (item.id === 'yen-no-decimals') item.ref = item.ref.replace('lang="en"', 'lang="ja"');
export default { name: 'currency-input', items };
