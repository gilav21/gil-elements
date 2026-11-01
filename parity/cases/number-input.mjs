// shadcn-angular number-input.component.ts (numberInputWrapperVariants) and .html: a bordered wrapper around a ghost ui-input with px-3.
// cn() is tailwind-merge: where a variant repeats a base utility the later one wins, so the repeated utilities are dropped by hand.
const WRAP_BASE = 'relative flex items-center border-input bg-transparent transition-colors focus-within:border-ring aria-disabled:pointer-events-none aria-disabled:opacity-50';
const WRAP = {
    outline: `${WRAP_BASE} focus-within:ring-ring/50 focus-within:ring-[3px] dark:bg-input/30 rounded-lg border`,
    underline: `${WRAP_BASE} rounded-none border-b border-t-0 border-x-0 focus-within:ring-0 shadow-none`,
    ghost: `${WRAP_BASE} border-none shadow-none focus-within:ring-0`,
};
const INNER = 'border-input aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-transparent text-base transition-colors md:text-sm placeholder:text-muted-foreground w-full min-w-0 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 border-none shadow-none focus-visible:ring-0 px-3';

const ref = ({ variant = 'outline', value = '', placeholder = '0', disabled = false } = {}) =>
    `<ui-number-input class="contents"><div class="${WRAP[variant]}" data-slot="number-input" data-variant="${variant}" ${disabled ? 'aria-disabled="true"' : ''}><ui-input class="contents"><input class="${INNER}" type="number" placeholder="${placeholder}" ${value === '' ? '' : `value="${value}"`} ${disabled ? 'disabled' : ''} data-slot="input"></ui-input></div></ui-number-input>`;
const el = ({ variant = 'outline', value = '', placeholder = '0', disabled = false } = {}) =>
    `<ge-number-input${variant === 'outline' ? '' : ` variant="${variant}"`}${value === '' ? '' : ` value="${value}"`}${placeholder === '0' ? '' : ` placeholder="${placeholder}"`}${disabled ? ' disabled' : ''}></ge-number-input>`;

const W = 'width:12rem;';
const pair = (id, props, extra = {}) => ({ id, wrap: W + (extra.wrap ?? ''), ref: ref(props), el: el(props), ...(extra.focus ? { focus: extra.focus } : {}) });
const focus = { ref: 'input', el: 'input' };
const items = [];
for (const variant of ['outline', 'underline', 'ghost']) {
    items.push(
        pair(`${variant}-empty`, { variant }),
        pair(`${variant}-value`, { variant, value: '42' }),
        pair(`${variant}-disabled`, { variant, value: '42', disabled: true }),
        pair(`${variant}-focus`, { variant, value: '42' }, { focus }),
    );
}
items.push(
    pair('placeholder', { placeholder: 'Quantity' }),
    pair('decimal', { value: '3.14' }),
    pair('density-1.5', { value: '42' }, { wrap: '--density:1.5;' }),
    pair('density-0.75', { value: '42' }, { wrap: '--density:0.75;' }),
);
export default { name: 'number-input', items };
