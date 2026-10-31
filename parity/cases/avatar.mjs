// shadcn-angular avatar.component.ts / .html / .css
const HOST = 'relative flex shrink-0 overflow-hidden rounded-full';
const FALLBACK = 'flex h-full w-full items-center justify-center rounded-full bg-muted';
const IMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#6366f1"/><circle cx="40" cy="32" r="14" fill="#fff"/></svg>');
const SPIN = '<svg class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';
export default {
    name: 'avatar',
    items: [
        { id: 'fallback', ref: `<div data-slot="avatar" class="${HOST}"><div class="${FALLBACK}" data-slot="avatar-fallback">JD</div></div>`, el: '<ge-avatar fallback="JD"></ge-avatar>' },
        { id: 'image', ref: `<div data-slot="avatar" class="${HOST}"><img src="${IMG}" alt="Jo" class="aspect-square h-full w-full" data-slot="avatar-image"></div>`, el: `<ge-avatar src="${IMG}" alt="Jo" fallback="JD"></ge-avatar>` },
        { id: 'image-slotted', ref: `<div data-slot="avatar" class="${HOST}"><img src="${IMG}" alt="Jo" class="aspect-square h-full w-full" data-slot="avatar-image"></div>`, el: `<ge-avatar><img src="${IMG}" alt="Jo"><span slot="fallback">JD</span></ge-avatar>` },
        { id: 'loading', at: 700, ref: `<div data-slot="avatar" class="${HOST}"><div class="${FALLBACK}" data-slot="avatar-fallback">JD</div><div class="absolute inset-0 flex items-center justify-center rounded-full bg-background/60"><output class="inline-flex" aria-label="Loading">${SPIN}</output></div></div>`, el: '<ge-avatar loading fallback="JD"></ge-avatar>' },
        { id: 'skeleton', at: 700, ref: '<div data-slot="avatar" class="block shrink-0"><div class="bg-primary/10 animate-pulse rounded-full h-10 w-10"></div></div>', el: '<ge-avatar skeleton></ge-avatar>' },
        { id: 'density-1.25', wrap: '--density:1.25;', ref: `<div data-slot="avatar" class="${HOST}"><div class="${FALLBACK}" data-slot="avatar-fallback">JD</div></div>`, el: '<ge-avatar fallback="JD"></ge-avatar>' },
    ],
};
