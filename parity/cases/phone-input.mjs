// shadcn-angular phone-input.component.html: a ui-input-group whose start addon (class `!pe-0`) holds a popover trigger button (flag, dial code, chevron),
// followed by a ghost ui-input of type tel. Class strings are copied from input-group.component and phone-input.component.ts.
const BASE = 'group/input-group relative flex w-full items-center transition-[color,box-shadow] outline-none min-w-0 has-[input:focus-visible]:ring-[3px]';
const VARIANT = {
    outline: 'rounded-md border border-input shadow-xs has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-ring/50',
    underline: 'rounded-none border-b border-input has-[input:focus-visible]:border-ring px-0 has-[input:focus-visible]:ring-0',
    ghost: 'border-none shadow-none has-[input:focus-visible]:ring-0',
};
const ADDON = 'text-muted-foreground flex h-auto items-center justify-center gap-2 text-sm font-medium select-none [&>svg:not([class*=size-])]:size-4 !pe-0';
const TRIGGER = 'flex items-center gap-1.5 px-2 py-1 rounded-s text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';
const INPUT = 'border-input aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-transparent text-base transition-colors md:text-sm placeholder:text-muted-foreground w-full min-w-0 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 border-none shadow-none focus-visible:ring-0 px-0';
// Angular's ui-input also dims itself (`disabled:opacity-50`) inside a group that is already at half opacity, so a disabled number is drawn at a quarter.
// The reference drops that second dimming (reported on shadcn-angular).
const INPUT_REF = INPUT.replace(' disabled:opacity-50', '');
const CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-60" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

const ref = ({ variant = 'outline', flag = '🇺🇸', dial = '+1', placeholder = '(555) 000-0000', value = '', disabled = false, dir = '' }) =>
    `<ui-phone-input class="contents"><ui-input-group class="contents" data-slot="phone-input" ${dir ? `dir="${dir}"` : ''}><fieldset class="${variant === 'outline' ? BASE : BASE.replace(' has-[input:focus-visible]:ring-[3px]', '')} ${VARIANT[variant]}${disabled ? ' opacity-50 cursor-not-allowed' : ''} min-w-0" data-slot="input-group" ${disabled ? 'disabled data-disabled="true"' : ''}>`
    + `<ui-input-group-addon class="contents"><div class="${ADDON}" data-slot="input-group-addon" data-align="inline-start"><ui-popover class="relative inline-block" data-slot="popover"><ui-popover-trigger class="contents"><span class="" data-slot="popover-trigger"><button type="button" class="${TRIGGER}" ${disabled ? 'disabled' : ''}><span>${flag}</span><span class="text-foreground font-medium">${dial}</span>${CHEVRON}</button></span></ui-popover-trigger></ui-popover></div></ui-input-group-addon>`
    + `<ui-input class="contents"><input class="${disabled ? INPUT_REF : INPUT}" type="tel" placeholder="${placeholder}" ${value ? `value="${value}"` : ''} ${disabled ? 'disabled' : ''} data-slot="input"></ui-input></fieldset></ui-input-group></ui-phone-input>`;
const el = ({ variant, value = '', attrs = '', disabled = false, dir = '' }) =>
    `${dir ? `<div dir="${dir}">` : ''}<ge-phone-input${variant ? ` variant="${variant}"` : ''}${value ? ` value="${value}"` : ''}${disabled ? ' disabled' : ''} ${attrs}></ge-phone-input>${dir ? '</div>' : ''}`;
const W = 'width:22rem;';
const F = { ref: 'input', el: 'ge-input-group-input input' };
const us = { value: '(555) 123-4567' };
export default {
    name: 'phone-input',
    items: [
        { id: 'empty', wrap: W, ref: ref({}), el: el({}) },
        { id: 'value', wrap: W, ref: ref(us), el: el({ value: '+15551234567' }) },
        { id: 'united-kingdom', wrap: W, ref: ref({ flag: '🇬🇧', dial: '+44', placeholder: '7911 123456', value: '2071 234567' }), el: el({ value: '+442071234567' }) },
        { id: 'default-country', wrap: W, ref: ref({ flag: '🇯🇵', dial: '+81', placeholder: '090-1234-5678' }), el: el({ attrs: 'default-country="JP"' }) },
        { id: 'custom-placeholder', wrap: W, ref: ref({ placeholder: 'Your number' }), el: el({ attrs: 'placeholder="Your number"' }) },
        ...['underline', 'ghost'].map((variant) => ({ id: variant, wrap: W, ref: ref({ variant, ...us }), el: el({ variant, value: '+15551234567' }) })),
        { id: 'disabled', wrap: W, ref: ref({ ...us, disabled: true }), el: el({ value: '+15551234567', disabled: true }) },
        { id: 'focus', wrap: W, focus: F, ref: ref(us), el: el({ value: '+15551234567' }) },
        { id: 'density-1.5', wrap: `${W}--density:1.5;`, ref: ref(us), el: el({ value: '+15551234567' }) },
        { id: 'rtl', wrap: W, ref: `<div dir="rtl">${ref(us)}</div>`, el: `<div dir="rtl">${el({ value: '+15551234567' })}</div>` },
    ],
};
