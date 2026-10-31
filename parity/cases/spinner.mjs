// shadcn-angular spinner.component.html + the size maps in spinner.component.ts
const RING = { xs: 'h-3 w-3', sm: 'h-4 w-4', default: 'h-5 w-5', lg: 'h-6 w-6', xl: 'h-8 w-8', page: 'h-12 w-12' };
const DOT = { xs: 'h-1 w-1', sm: 'h-1.5 w-1.5', default: 'h-2 w-2', lg: 'h-2.5 w-2.5', xl: 'h-3 w-3', page: 'h-4 w-4' };
const BAR = { xs: 'w-0.5 h-3', sm: 'w-1 h-4', default: 'w-1 h-5', lg: 'w-1.5 h-6', xl: 'w-2 h-8', page: 'w-2.5 h-10' };
const PATH = '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>';
const ring = (size) => `<output class="inline-flex" aria-label="Loading"><svg class="animate-spin ${RING[size]}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATH}</svg></output>`;
const dots = (size) => `<output class="flex items-center gap-1" aria-label="Loading"><div class="${DOT[size]} rounded-full bg-current animate-bounce [animation-delay:-0.3s]"></div><div class="${DOT[size]} rounded-full bg-current animate-bounce [animation-delay:-0.15s]"></div><div class="${DOT[size]} rounded-full bg-current animate-bounce"></div></output>`;
const bars = (size) => `<output class="flex items-center gap-0.5" aria-label="Loading">${['0s', '0.1s', '0.2s', '0.3s', '0.4s'].map((d) => `<div class="${BAR[size]} bg-current rounded-sm animate-pulse" style="animation-delay:${d}"></div>`).join('')}</output>`;
const pulse = (size) => `<output class="${RING[size]} block rounded-full bg-current animate-pulse" aria-label="Loading"></output>`;
const items = [];
for (const size of Object.keys(RING)) {
    const attr = size === 'default' ? '' : ` size="${size}"`;
    items.push({ id: `ring-${size}`, ref: ring(size), el: `<ge-spinner${attr}></ge-spinner>` });
    items.push({ id: `dots-${size}`, ref: dots(size), el: `<ge-spinner variant="dots"${attr}></ge-spinner>` });
    items.push({ id: `bars-${size}`, ref: bars(size), el: `<ge-spinner variant="bars"${attr}></ge-spinner>` });
    items.push({ id: `pulse-${size}`, ref: pulse(size), el: `<ge-spinner variant="pulse"${attr}></ge-spinner>` });
}
items.push({ id: 'ring-custom-30', ref: ring('default').replace('animate-spin h-5 w-5"', 'animate-spin" style="width: 30px; height: 30px;"'), el: '<ge-spinner custom-size="30"></ge-spinner>' });
export default { name: 'spinner', items };
