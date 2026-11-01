// shadcn-angular rating.component.html and .ts (classes, starClasses, glyphClasses).
const POLY = '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2';
const GLYPH = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' };
const SVG = 'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"';
const STROKE = 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

let gradient = 0;
const glyph = (fill, size, rtl) => {
    const cls = GLYPH[size];
    if (fill === 'full') return `<svg ${SVG} fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><polygon points="${POLY}"/></svg>`;
    if (fill === 'empty') return `<svg ${SVG} fill="none" ${STROKE} class="${cls}"><polygon points="${POLY}"/></svg>`;
    const id = `half-ref-${++gradient}`;
    const stops = rtl ? '<stop offset="50%" stop-color="transparent"/><stop offset="50%" stop-color="currentColor"/>' : '<stop offset="50%" stop-color="currentColor"/><stop offset="50%" stop-color="transparent"/>';
    return `<svg ${SVG} class="${cls}"><defs><linearGradient id="${id}">${stops}</linearGradient></defs><polygon points="${POLY}" fill="url(#${id})" ${STROKE}/></svg>`;
};
const fillOf = (value, n, precision) => (value >= n ? 'full' : precision === 0.5 && value >= n - 0.5 ? 'half' : 'empty');

const ref = ({ value = 0, max = 5, precision = 1, size = 'md', readonly = false, disabled = false, rtl = false } = {}) => {
    const interactive = !disabled && !readonly;
    const stars = Array.from({ length: max }, (...[, i]) => {
        const fill = fillOf(value, i + 1, precision);
        const cls = `transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm ${GLYPH[size]} ${fill === 'empty' ? 'text-muted-foreground/30' : 'text-yellow-400'}${interactive ? ' cursor-pointer hover:scale-110' : ''}`;
        return `<button type="button" data-star class="${cls}" aria-label="Rate ${i + 1} out of ${max}" ${disabled || readonly ? 'disabled' : ''}>${glyph(fill, size, rtl)}</button>`;
    }).join('');
    const rowClass = `inline-flex items-center gap-0.5${disabled ? ' opacity-50 cursor-not-allowed' : ''}${readonly ? ' pointer-events-none' : ''}`;
    const body = `<ui-rating class="inline-flex"><div class="${rowClass}" data-slot="rating" style="touch-action: none"><input type="range" class="sr-only" min="0" max="${max}" step="${precision}" value="${value}" ${disabled || readonly ? 'disabled' : ''} aria-label="Rating">${stars}</div></ui-rating>`;
    return rtl ? `<div dir="rtl">${body}</div>` : body;
};
const el = ({ value = 0, max = 5, precision = 1, size = 'md', readonly = false, disabled = false, rtl = false } = {}) => {
    const tag = `<ge-rating${value ? ` value="${value}"` : ''}${max === 5 ? '' : ` max="${max}"`}${precision === 1 ? '' : ` precision="${precision}"`}${size === 'md' ? '' : ` size="${size}"`}${readonly ? ' readonly' : ''}${disabled ? ' disabled' : ''}></ge-rating>`;
    return rtl ? `<div dir="rtl">${tag}</div>` : tag;
};

const pair = (id, props, extra = {}) => ({ id, ref: ref(props), el: el(props), ...extra });
const focus = { ref: 'button', el: '.star' };
export default {
    name: 'rating',
    items: [
        pair('empty', {}),
        pair('three', { value: 3 }),
        pair('full', { value: 5 }),
        pair('half', { value: 2.5, precision: 0.5 }),
        pair('half-on-whole-precision-rounds-down', { value: 2.5 }),
        pair('max-3', { value: 2, max: 3 }),
        pair('max-10', { value: 7, max: 10 }),
        pair('size-sm', { value: 3, size: 'sm' }),
        pair('size-lg', { value: 3, size: 'lg' }),
        pair('half-sm', { value: 1.5, precision: 0.5, size: 'sm' }),
        pair('readonly', { value: 4, readonly: true }),
        pair('disabled', { value: 4, disabled: true }),
        pair('rtl-three', { value: 3, rtl: true }),
        pair('rtl-half', { value: 2.5, precision: 0.5, rtl: true }),
        pair('focus', { value: 3 }, { focus }),
    ],
};
