// shadcn-angular pagination.component.ts (simple mode) and sub/pagination-*.component.ts
const NAV = 'mx-auto flex w-full justify-center';
const NAVBTN = 'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
const NAVBTN_CUSTOM = NAVBTN.replace('text-sm font-medium', 'text-sm font-medium h-9 px-4 py-2');
const DIS = 'disabled:pointer-events-none disabled:opacity-50';
const LINK = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';
const ON = 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground';
const OFF = 'hover:bg-accent hover:text-accent-foreground';
const PREV = '<svg class="h-4 w-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>';
const NEXT = '<svg class="h-4 w-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>';
const DOTS = '<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /><circle cx="5" cy="12" r="1.5" /></svg>';

const pages = (current, total, s = 1) => {
    const range = (a, b) => Array.from({ length: b - a + 1 }, (...[, i]) => a + i);
    if (total <= s * 2 + 5) return range(1, total);
    const l = Math.max(current - s, 1), r = Math.min(current + s, total), le = l > 2, re = r < total - 1, e = 3 + 2 * s;
    if (!le && re) return [...range(1, e), -1, total];
    if (le && !re) return [1, -1, ...range(total - e + 1, total)];
    return [1, -1, ...range(l, r), -1, total];
};
const simpleRef = (current, total) =>
    `<ui-pagination class="contents"><nav role="navigation" aria-label="pagination" class="${NAV}" data-slot="pagination"><ul class="flex flex-row flex-wrap items-center gap-1" data-slot="pagination-content"><li><button type="button" class="${NAVBTN} ${DIS}" data-size="default" ${current <= 1 ? 'disabled' : ''} data-slot="pagination-previous">${PREV}<span>Previous</span></button></li>${pages(current, total)
        .map((p) => (p === -1 ? `<li><span class="flex h-9 w-9 items-center justify-center" data-slot="pagination-ellipsis" aria-hidden="true">${DOTS}<span class="sr-only">More pages</span></span></li>` : `<li><button type="button" class="${LINK} ${p === current ? ON : OFF}" data-size="icon" ${p === current ? 'aria-current="page"' : ''} data-slot="pagination-link">${p}</button></li>`))
        .join('')}<li><button type="button" class="${NAVBTN} ${DIS}" data-size="default" ${current >= total ? 'disabled' : ''} data-slot="pagination-next"><span>Next</span>${NEXT}</button></li></ul></nav></ui-pagination>`;
const simpleEl = (current, total, extra = '') => `<ge-pagination current-page="${current}" total-pages="${total}"${extra}></ge-pagination>`;

// Custom mode.
const link = (label, { active = false, size = 'icon', disabled = false } = {}) => {
    // Height, width and padding come from the density rule on data-size, not from utilities.
    const dims = { icon: '', default: '', sm: 'text-xs', lg: '' }[size];
    return `<ui-pagination-item><ui-pagination-link class="contents"><button type="button" class="${LINK} ${active ? ON : OFF} ${dims}" ${active ? 'aria-current="page"' : ''} ${disabled ? 'disabled' : ''} data-slot="pagination-link" data-size="${size}">${label}</button></ui-pagination-link></ui-pagination-item>`;
};
const customRef = (inner) => `<ui-pagination class="contents"><nav role="navigation" aria-label="pagination" class="${NAV}" data-slot="pagination"><ui-pagination-content class="flex flex-row items-center gap-1" data-slot="pagination-content">${inner}</ui-pagination-content></nav></ui-pagination>`;
const prev = (disabled) => `<ui-pagination-item><ui-pagination-previous class="contents"><button type="button" class="${NAVBTN_CUSTOM} ${DIS}" ${disabled ? 'disabled' : ''} data-slot="pagination-previous">${PREV}<span>Previous</span></button></ui-pagination-previous></ui-pagination-item>`;
const next = `<ui-pagination-item><ui-pagination-next class="contents"><button type="button" class="${NAVBTN_CUSTOM} ${DIS}" data-slot="pagination-next"><span>Next</span>${NEXT}</button></ui-pagination-next></ui-pagination-item>`;
const dots = '<ui-pagination-item><ui-pagination-ellipsis class="contents"><span class="flex h-9 w-9 items-center justify-center" data-slot="pagination-ellipsis" aria-hidden="true">' + DOTS + '<span class="sr-only">More pages</span></span></ui-pagination-ellipsis></ui-pagination-item>';
const elPrev = (d) => `<ge-pagination-item><ge-pagination-previous${d ? ' disabled' : ''}></ge-pagination-previous></ge-pagination-item>`;
const elLink = (label, attrs = '') => `<ge-pagination-item><ge-pagination-link${attrs}>${label}</ge-pagination-link></ge-pagination-item>`;
const elCustom = (inner) => `<ge-pagination><ge-pagination-content>${inner}</ge-pagination-content></ge-pagination>`;
const elNext = '<ge-pagination-item><ge-pagination-next></ge-pagination-next></ge-pagination-item>';
const elDots = '<ge-pagination-item><ge-pagination-ellipsis></ge-pagination-ellipsis></ge-pagination-item>';

const W = 'display:block;width:560px;';
const items = [
    { id: 'simple-first-of-10', wrap: W, ref: simpleRef(1, 10), el: simpleEl(1, 10) },
    { id: 'simple-middle-of-20', wrap: W, ref: simpleRef(10, 20), el: simpleEl(10, 20) },
    { id: 'simple-last-of-10', wrap: W, ref: simpleRef(10, 10), el: simpleEl(10, 10) },
    { id: 'simple-few', wrap: W, ref: simpleRef(2, 3), el: simpleEl(2, 3) },
    { id: 'simple-focus', wrap: W, focus: { ref: 'button[aria-current=page]', el: 'ge-pagination-link[active]' }, ref: simpleRef(2, 3), el: simpleEl(2, 3) },
    { id: 'simple-density-1.5', wrap: `${W}--density:1.5;`, ref: simpleRef(2, 6), el: simpleEl(2, 6) },
    { id: 'simple-rtl', wrap: W, ref: `<div dir="rtl">${simpleRef(1, 4)}</div>`, el: `<div dir="rtl">${simpleEl(1, 4)}</div>` },
    { id: 'custom', wrap: W, ref: customRef(`${prev(false)}${link(1)}${link(2, { active: true })}${link(3)}${dots}${next}`), el: elCustom(`${elPrev(false)}${elLink(1)}${elLink(2, ' active')}${elLink(3)}${elDots}${elNext}`) },
    { id: 'custom-disabled-previous', wrap: W, ref: customRef(`${prev(true)}${link(1, { active: true })}${next}`), el: elCustom(`${elPrev(true)}${elLink(1, ' active')}${elNext}`) },
    { id: 'custom-sizes', wrap: W, ref: customRef(`${link('Default', { size: 'default' })}${link('Small', { size: 'sm' })}${link('Large', { size: 'lg' })}${link('x', { disabled: true })}`), el: elCustom(`${elLink('Default', ' size="default"')}${elLink('Small', ' size="sm"')}${elLink('Large', ' size="lg"')}${elLink('x', ' disabled')}`) },
    { id: 'custom-density-1.5', wrap: `${W}--density:1.5;`, ref: customRef(`${link('Default', { size: 'default' })}${link(1, { active: true })}${link('Small', { size: 'sm' })}`), el: elCustom(`${elLink('Default', ' size="default"')}${elLink(1, ' active')}${elLink('Small', ' size="sm"')}`) },
];
export default { name: 'pagination', items };
