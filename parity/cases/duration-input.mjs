// shadcn-angular duration-input.component: an inline-flex fieldset (w-fit, gap-0.5, px-2, rounded-lg border, ring on focus-within) of spinbutton text
// segments sized in ch, with a `:` between them.
const BASE = 'inline-flex w-fit items-center gap-0.5 border-input bg-transparent px-2 transition-colors focus-within:border-ring aria-disabled:pointer-events-none aria-disabled:opacity-50';
const WRAP = {
    outline: `${BASE} focus-within:ring-ring/50 focus-within:ring-[3px] dark:bg-input/30 rounded-lg border`,
    underline: `${BASE} rounded-none border-b border-x-0 border-t-0 shadow-none focus-within:ring-0`,
    ghost: `${BASE} border-none shadow-none focus-within:ring-0`,
};
const SEG = 'bg-transparent py-1 text-center tabular-nums outline-none disabled:cursor-not-allowed pointer-coarse:py-2.5';
const UNIT_TEXT = { hours: 'hours', minutes: 'minutes', seconds: 'seconds' };
const toParts = (total, units) => {
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (units.includes('hours')) return { hours, minutes: units.includes('minutes') ? minutes : 0, seconds: total % 60 };
    return { hours: 0, minutes: Math.floor(total / 60), seconds: units.includes('minutes') ? total % 60 : total };
};
const ref = ({ variant = 'outline', value = null, units = ['hours', 'minutes'], disabled = false }) => {
    const parts = toParts(value ?? 0, units);
    const segments = units.map((unit, index) => {
        const text = value === null ? '' : String(parts[unit]).padStart(index === 0 ? 1 : 2, '0');
        const placeholder = index === 0 ? '0' : '00';
        const width = Math.max(2, text.length, placeholder.length) + 1;
        const input = `<input type="text" inputmode="numeric" autocomplete="off" class="${SEG}" style="width:${width}ch" role="spinbutton" data-slot="duration-input-segment" data-unit="${unit}" value="${text}" ${disabled ? 'disabled' : ''} aria-label="${UNIT_TEXT[unit]}" placeholder="${placeholder}">`;
        return index < units.length - 1 ? `${input}<span aria-hidden="true" class="text-muted-foreground select-none">:</span>` : input;
    });
    return `<ui-duration-input class="contents"><fieldset class="${WRAP[variant]}" data-slot="duration-input" data-variant="${variant}" aria-label="Duration" ${disabled ? 'aria-disabled="true"' : ''} style="margin:0;padding-block:0;min-inline-size:0"><span hidden></span>${segments.join('')}</fieldset></ui-duration-input>`;
};
const el = ({ variant = 'outline', value = null, units = ['hours', 'minutes'], disabled = false }) =>
    `<ge-duration-input units="${units.join(',')}"${variant === 'outline' ? '' : ` variant="${variant}"`}${value === null ? '' : ` value="${value}"`}${disabled ? ' disabled' : ''}></ge-duration-input>`;
const pair = (id, props, extra = {}) => ({ id, wrap: extra.wrap ?? '', ref: ref(props), el: el(props), ...(extra.focus ? { focus: extra.focus } : {}) });
const items = [];
for (const variant of ['outline', 'underline', 'ghost']) items.push(pair(`${variant}-empty`, { variant }), pair(`${variant}-value`, { variant, value: 5400 }));
items.push(
    pair('disabled', { value: 5400, disabled: true }),
    pair('hours-minutes-seconds', { value: 3725, units: ['hours', 'minutes', 'seconds'] }),
    pair('minutes-seconds-beyond-an-hour', { value: 5400, units: ['minutes', 'seconds'] }),
    pair('seconds-only', { value: 125, units: ['seconds'] }),
    pair('wide-leading-segment', { value: 360000, units: ['minutes', 'seconds'] }),
    pair('focus', { value: 5400 }, { focus: { ref: 'input[data-unit=minutes]', el: 'input[data-unit=minutes]' } }),
    pair('density-1.5', { value: 5400 }, { wrap: '--density:1.5;' }),
);
export default { name: 'duration-input', items };
