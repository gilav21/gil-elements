// shadcn-angular time-picker.component.html/.ts, with the layout computed the way time-picker.format.ts computes it.
// The reference is built in the page, because Intl's separators (a plain space or a narrow no-break space) depend on the
// browser's ICU, and the Angular component asks the same browser.
function buildRef(opts) {
const WRAP = 'inline-flex w-fit items-center gap-0.5 border-input bg-transparent px-2 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] aria-disabled:pointer-events-none aria-disabled:opacity-50';
const VARIANT = {
    outline: 'dark:bg-input/30 rounded-lg border',
    underline: 'rounded-none border-b border-x-0 border-t-0 shadow-none focus-within:ring-0',
    ghost: 'border-none shadow-none focus-within:ring-0',
};
const INPUT = 'w-[3ch] bg-transparent py-1 text-center tabular-nums outline-none disabled:cursor-not-allowed pointer-coarse:py-2.5';
const BUTTON = 'rounded px-1 py-1 text-sm font-medium tabular-nums outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed pointer-coarse:min-h-11 pointer-coarse:px-2';
const LABEL = { hour: 'hour', minute: 'minute', second: 'second', dayPeriod: 'AM or PM' };

const at = (hours) => new Date(Date.UTC(2020, 0, 1, hours, 5, 9));
const layoutOf = (locale, withSeconds) => {
    const options = { hour: 'numeric', minute: '2-digit', timeZone: 'UTC', ...(withSeconds ? { second: '2-digit' } : {}) };
    const formatter = new Intl.DateTimeFormat(locale, options);
    const order = [];
    const separators = [];
    let pending = '';
    for (const part of formatter.formatToParts(at(21))) {
        if (part.type === 'literal') {
            pending += part.value;
            continue;
        }
        if (!['hour', 'minute', 'second', 'dayPeriod'].includes(part.type)) continue;
        if (order.length > 0) separators.push(pending.replace(/[‎‏⁦-⁩]/g, ''));
        pending = '';
        order.push(part.type);
    }
    const period = (h) => formatter.formatToParts(at(h)).find((p) => p.type === 'dayPeriod')?.value ?? '';
    const digitFormatter = new Intl.NumberFormat(locale, { useGrouping: false });
    return { order, separators, hour12: formatter.resolvedOptions().hour12 === true, am: period(9), pm: period(21), digits: Array.from({ length: 10 }, (...[, d]) => digitFormatter.format(d)) };
};
const pad = (n, width, digits) => String(n).padStart(width, '0').replace(/\d/g, (d) => digits[Number(d)]);

return (({ value = '', locale = 'en-US', seconds = false, variant = 'outline', disabled = false } = {}) => {
    const layout = layoutOf(locale, seconds);
    const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
    const h24 = m ? Number(m[1]) : null;
    const shown = {
        hour: h24 === null ? '' : pad(layout.hour12 ? h24 % 12 || 12 : h24, layout.hour12 ? 1 : 2, layout.digits),
        minute: m ? pad(Number(m[2]), 2, layout.digits) : '',
        second: m ? pad(Number(m[3] ?? 0), 2, layout.digits) : pad(0, 2, layout.digits),
    };
    const valueNow = (kind) => (kind === 'hour' ? (h24 === null ? (layout.hour12 ? 1 : 0) : layout.hour12 ? h24 % 12 || 12 : h24) : kind === 'minute' ? (m ? Number(m[2]) : 0) : Number(m?.[3] ?? 0));
    const bounds = (kind) => (kind === 'hour' ? (layout.hour12 ? [1, 12] : [0, 23]) : [0, 59]);
    const segments = layout.order.map((kind, i) => {
        const sep = layout.separators[i] ? `<span aria-hidden="true" class="text-muted-foreground select-none">${layout.separators[i]}</span>` : '';
        if (kind === 'dayPeriod') {
            const text = h24 !== null && h24 >= 12 ? layout.pm : h24 === null ? layout.am : layout.am;
            return `<button type="button" class="${BUTTON}" data-slot="time-picker-period"${disabled ? ' disabled' : ''} aria-label="${LABEL[kind]}">${text}</button>${sep}`;
        }
        const [min, max] = bounds(kind);
        return `<input type="text" inputmode="numeric" autocomplete="off" class="${INPUT}" role="spinbutton" data-slot="time-picker-segment" data-segment="${kind}" value="${shown[kind]}"${disabled ? ' disabled' : ''} aria-label="${LABEL[kind]}" aria-valuenow="${valueNow(kind)}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuetext="${shown[kind]} ${LABEL[kind]}" placeholder="--">${sep}`;
    });
    const text = value ? '' : '';
    return `<ui-time-picker class="contents"><fieldset class="${WRAP} ${VARIANT[variant]}" dir="ltr" data-slot="time-picker" data-variant="${variant}" aria-label="Time"${disabled ? ' aria-disabled="true"' : ''}><span hidden>${text}</span>${segments.join('')}</fieldset></ui-time-picker>`;
})(opts);
}
const ref = (opts = {}) => `<span data-tp></span><script>document.currentScript.previousElementSibling.outerHTML = (${buildRef})(${JSON.stringify(opts)}); document.currentScript.remove();</script>`;
const el = ({ value = '', locale = 'en-US', seconds = false, variant = 'outline', disabled = false } = {}) =>
    `<ge-time-picker${value ? ` value="${value}"` : ''} locale="${locale}"${seconds ? ' with-seconds' : ''}${variant === 'outline' ? '' : ` variant="${variant}"`}${disabled ? ' disabled' : ''}></ge-time-picker>`;

const one = (id, opts = {}, wrap = '', focus) => ({ id, wrap: `display:flex;${wrap}`, ref: ref(opts), el: el(opts), ...(focus ? { focus } : {}) });
const items = [
    one('en-us', { value: '21:05' }),
    one('en-us-morning', { value: '09:05' }),
    one('midnight', { value: '00:05' }),
    one('de', { value: '21:05', locale: 'de-DE' }),
    one('arabic', { value: '21:05', locale: 'ar-EG' }),
    one('zh-tw', { value: '21:05', locale: 'zh-TW' }),
    one('empty'),
    one('seconds', { value: '09:05:09', locale: 'en-GB', seconds: true }),
    one('disabled', { value: '21:05', disabled: true }),
    one('underline', { value: '21:05', variant: 'underline' }),
    one('ghost', { value: '21:05', variant: 'ghost' }),
    one('density-1.5', { value: '21:05' }, '--density:1.5;'),
    { id: 'rtl', wrap: 'display:flex', ref: `<div dir="rtl">${ref({ value: '21:05' })}</div>`, el: `<div dir="rtl">${el({ value: '21:05' })}</div>` },
    one('focused-segment', { value: '21:05' }, '', { ref: "input[data-segment='minute']", el: "input[data-segment='minute']" }),
];
export default { name: 'time-picker', items };
