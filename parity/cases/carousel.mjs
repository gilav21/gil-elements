// shadcn-angular carousel.component.ts and sub/*.component.ts.
const BTN = 'absolute h-8 w-8 rounded-full z-10 inline-flex items-center justify-center border border-input bg-background/80 sm:bg-background shadow-sm backdrop-blur-sm sm:backdrop-blur-none hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transition-colors';
const POS = {
    horizontal: { prev: 'left-2 sm:-left-12 top-1/2 -translate-y-1/2', next: 'right-2 sm:-right-12 top-1/2 -translate-y-1/2' },
    vertical: { prev: '-top-12 left-1/2 -translate-x-1/2 rotate-90', next: '-bottom-12 left-1/2 -translate-x-1/2 rotate-90' },
};
const SVG = (path) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="${path}"/></svg>`;
const button = (tag, orientation, side, label, path, disabled) =>
    `<ui-carousel-${tag} class="contents"><button type="button" class="${BTN} ${POS[orientation][side]}" data-slot="carousel-${tag}"${disabled ? ' disabled' : ''} aria-label="${label}">${SVG(path)}<span class="sr-only">${label}</span></button></ui-carousel-${tag}>`;

const slide = (n, size) =>
    `<div class="p-1"><div class="flex items-center justify-center rounded-lg border bg-card p-6 text-card-foreground ${size}"><span class="text-4xl font-semibold">${n}</span></div></div>`;
const eSlide = (n, size) =>
    `<div style="padding:0.25rem"><div style="display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:var(--radius);background:var(--card);color:var(--card-foreground);padding:1.5rem;${size}"><span style="font-size:2.25rem;line-height:2.5rem;font-weight:600">${n}</span></div></div>`;

const ref = ({ orientation = 'horizontal', end = false, basis = '', count = 5, root = 'w-full max-w-xs', trackClass = '', size = 'aspect-square', rtl = false } = {}) => {
    const horizontal = orientation === 'horizontal';
    const track = `flex ${horizontal ? '-ms-4' : '-mt-4 flex-col'} scroll-smooth snap-mandatory scrollbar-hide ${horizontal ? 'overflow-x-auto snap-x' : 'overflow-y-auto snap-y'} ${trackClass}`.trim();
    const items = Array.from({ length: count }, (...[, i]) => `<ui-carousel-item class="contents"><div class="min-w-0 shrink-0 grow-0 ${basis || 'basis-full'} ${horizontal ? 'ps-4' : 'pt-4'} snap-start" data-slot="carousel-item" role="group" aria-roledescription="slide">${slide(i + 1, size)}</div></ui-carousel-item>`).join('');
    return `<ui-carousel class="contents"><div class="relative ${root}" data-slot="carousel" data-orientation="${orientation}" role="region" aria-roledescription="carousel"><ui-carousel-content class="contents"><div class="${track}" tabindex="0" data-slot="carousel-content"${end ? ' data-scroll-end' : ''}>${items}</div></ui-carousel-content>${button('previous', orientation, 'prev', 'Previous slide', 'm15 18-6-6 6-6', rtl ? end : !end)}${button('next', orientation, 'next', 'Next slide', 'm9 18 6-6-6-6', rtl ? !end : end)}</div></ui-carousel>`;
};
const el = ({ orientation = 'horizontal', end = false, basis = '', count = 5, root = 'width:100%;max-width:20rem;', trackClass = '', size = 'aspect-ratio:1' } = {}) => {
    const items = Array.from({ length: count }, (...[, i]) => `<ge-carousel-item${basis ? ` style="flex-basis:${basis}"` : ''}>${eSlide(i + 1, size)}</ge-carousel-item>`).join('');
    return `<ge-carousel${orientation === 'vertical' ? ' orientation="vertical"' : ''} style="${root}"><ge-carousel-content${trackClass ? ` style="${trackClass}"` : ''}${end ? ' data-scroll-end' : ''}>${items}</ge-carousel-content><ge-carousel-previous></ge-carousel-previous><ge-carousel-next></ge-carousel-next></ge-carousel>`;
};

const W = 'width:460px;padding:24px 72px;box-sizing:content-box;';
const items = [
    { id: 'horizontal', wrap: W, ref: ref(), el: el() },
    { id: 'horizontal-end', wrap: W, ref: ref({ end: true }), el: el({ end: true }) },
    { id: 'basis-half', wrap: W, ref: ref({ basis: 'basis-1/2', root: 'w-full max-w-md', size: 'h-24' }), el: el({ basis: '50%', root: 'width:100%;max-width:28rem;', size: 'height:6rem' }) },
    { id: 'vertical', wrap: 'width:400px;padding:72px 24px;box-sizing:content-box;', ref: ref({ orientation: 'vertical', root: 'w-full max-w-xs', trackClass: 'h-[200px]', size: 'h-24' }), el: el({ orientation: 'vertical', root: 'width:100%;max-width:20rem;', trackClass: 'height:200px', size: 'height:6rem' }) },
    { id: 'vertical-end', wrap: 'width:400px;padding:72px 24px;box-sizing:content-box;', ref: ref({ orientation: 'vertical', end: true, root: 'w-full max-w-xs', trackClass: 'h-[200px]', size: 'h-24' }), el: el({ orientation: 'vertical', end: true, root: 'width:100%;max-width:20rem;', trackClass: 'height:200px', size: 'height:6rem' }) },
    { id: 'rtl', wrap: W, ref: `<div dir="rtl">${ref({ rtl: true })}</div>`, el: `<div dir="rtl">${el()}</div>` },
    { id: 'rtl-end', wrap: W, ref: `<div dir="rtl">${ref({ end: true, rtl: true })}</div>`, el: `<div dir="rtl">${el({ end: true })}</div>` },
    { id: 'focused-button', wrap: W, ref: ref(), el: el(), focus: { ref: "button[data-slot='carousel-next']", el: 'ge-carousel-next button' } },
];
export default { name: 'carousel', isolated: false, items };
