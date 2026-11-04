// shadcn-angular input-otp.component.ts: slots drawn over a visually hidden input.
const SLOT = 'relative flex items-center justify-center border-y border-r border-input text-sm shadow-sm transition-all cursor-text';

const slot = (i, { value, count, separator, active }) => {
    const classes = [
        SLOT,
        i === 0 && 'rounded-l-md border-l',
        i === count - 1 && 'rounded-r-md',
        separator.includes(i) && 'rounded-r-md',
        separator.includes(i - 1) && 'rounded-l-md border-l',
        active === i && 'z-10 ring-2 ring-ring',
    ].filter(Boolean).join(' ');
    const char = value[i] ?? '';
    const caret = active === i && !char ? '<div class="pointer-events-none absolute inset-0 flex items-center justify-center"><div class="h-4 w-px animate-caret-blink bg-foreground"></div></div>' : '';
    const dot = separator.includes(i) ? '<div class="flex items-center px-1" aria-hidden="true"><div class="h-1 w-1 rounded-full bg-muted-foreground"></div></div>' : '';
    return `<div class="${classes}" data-slot="input-otp-slot" aria-hidden="true"><span class="text-center">${char}</span>${caret}</div>${dot}`;
};

const ref = ({ value = '', count = 6, separator = [2], disabled = false, active = -1 } = {}) =>
    `<ui-input-otp class="contents"><div dir="ltr" class="flex items-center gap-0 has-[:disabled]:opacity-50" data-slot="input-otp">` +
    Array.from({ length: count }, (_, i) => slot(i, { value, count, separator, active })).join('') +
    `<input type="text" inputmode="numeric" maxlength="${count}" value="${value}" ${disabled ? 'disabled' : ''} aria-label="One-time code" class="sr-only" autocomplete="one-time-code"></div></ui-input-otp>`;

const el = (attrs = '') => `<ge-input-otp ${attrs}></ge-input-otp>`;
const W = 'width:24rem;';
const both = (id, p, attrs = '', wrap = W) => ({ id, wrap, ref: ref(p), el: el(attrs) });

export default {
    name: 'input-otp',
    items: [
        both('empty', {}),
        both('partial', { value: '123' }, 'value="123"'),
        both('full', { value: 'AB12CD' }, 'value="AB12CD"'),
        both('no-separator', { value: '1234', separator: [] }, 'value="1234" separator=""'),
        both('two-separators', { value: '1234', count: 8, separator: [1, 5] }, 'value="1234" max-length="8" separator="1,5"'),
        both('four-digits', { value: '12', count: 4, separator: [] }, 'value="12" max-length="4" separator=""'),
        both('disabled', { value: '123', disabled: true }, 'value="123" disabled'),
        both('density-1.5', { value: '123' }, 'value="123"', `${W}--density:1.5;`),
        both('density-0.75', { value: '123' }, 'value="123"', `${W}--density:0.75;`),
        { id: 'rtl', wrap: W, ref: `<div dir="rtl">${ref({ value: '123' })}</div>`, el: `<div dir="rtl">${el('value="123"')}</div>` },
        { id: 'focus-empty', wrap: W, focus: { ref: 'input', el: 'input' }, ref: ref({ active: 0 }), el: el() },
        { id: 'focus-partial', wrap: W, focus: { ref: 'input', el: 'input' }, ref: ref({ value: '123', active: 3 }), el: el('value="123"') },
        { id: 'focus-full', wrap: W, focus: { ref: 'input', el: 'input' }, ref: ref({ value: 'AB12CD', active: 5 }), el: el('value="AB12CD"') },
    ],
};
