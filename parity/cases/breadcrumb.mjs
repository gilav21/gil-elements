// shadcn-angular breadcrumb.component.ts and sub/breadcrumb-*.component.ts
const LIST = 'text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5';
const CHEVRON = '<svg class="size-3.5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>';
const nav = (inner) => `<ui-breadcrumb class="contents"><nav aria-label="breadcrumb" data-slot="breadcrumb"><ui-breadcrumb-list class="${LIST}" data-slot="breadcrumb-list">${inner}</ui-breadcrumb-list></nav></ui-breadcrumb>`;
const item = (inner) => `<ui-breadcrumb-item class="inline-flex items-center gap-1.5" data-slot="breadcrumb-item">${inner}</ui-breadcrumb-item>`;
const link = (label) => item(`<ui-breadcrumb-link class="contents" data-slot="breadcrumb-link"><a href="#" class="hover:text-foreground transition-colors">${label}</a></ui-breadcrumb-link>`);
const page = (label) => item(`<ui-breadcrumb-page role="link" aria-disabled="true" aria-current="page" class="text-foreground font-normal" data-slot="breadcrumb-page">${label}</ui-breadcrumb-page>`);
const sep = (custom) => `<ui-breadcrumb-separator role="presentation" aria-hidden="true" class="[&>svg]:size-3.5" data-slot="breadcrumb-separator"><span class="contents">${custom ?? ''}</span>${custom ? '' : CHEVRON}</ui-breadcrumb-separator>`;
const ellipsis = () =>
    '<ui-breadcrumb-ellipsis class="contents" data-slot="breadcrumb-ellipsis"><span role="presentation" aria-hidden="true" class="flex items-center justify-center"><svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg><span class="sr-only">More</span></span></ui-breadcrumb-ellipsis>';

const elLink = (label) => `<ge-breadcrumb-item><ge-breadcrumb-link>${label}</ge-breadcrumb-link></ge-breadcrumb-item>`;
const elPage = (label) => `<ge-breadcrumb-item><ge-breadcrumb-page>${label}</ge-breadcrumb-page></ge-breadcrumb-item>`;
const elSep = (custom) => `<ge-breadcrumb-separator>${custom ?? ''}</ge-breadcrumb-separator>`;
const elNav = (inner) => `<ge-breadcrumb><ge-breadcrumb-list>${inner}</ge-breadcrumb-list></ge-breadcrumb>`;

const simpleRef = (entries) =>
    nav(
        entries
            .map(
                (e, i) =>
                    `<span class="inline-flex items-center gap-1.5" data-slot="breadcrumb-item">${e.isCurrentPage ? `<span role="link" aria-disabled="true" aria-current="page" class="text-foreground font-normal" data-slot="breadcrumb-page">${e.label}</span>` : `<a href="${e.href || '#'}" class="hover:text-foreground transition-colors" data-slot="breadcrumb-link">${e.label}</a>`}</span>${i < entries.length - 1 ? `<span role="presentation" aria-hidden="true" class="[&>svg]:size-3.5" data-slot="breadcrumb-separator">${CHEVRON}</span>` : ''}`,
            )
            .join(''),
    );
const ENTRIES = [{ label: 'Home', href: '#' }, { label: 'Components', href: '#' }, { label: 'Breadcrumb', isCurrentPage: true }];
const simpleEl = (id) =>
    `<ge-breadcrumb><ge-breadcrumb-list id="${id}"></ge-breadcrumb-list></ge-breadcrumb><script>document.getElementById('${id}').items = ${JSON.stringify(ENTRIES)}</script>`;

const trail = nav(`${link('Home')}${sep()}${link('Components')}${sep()}${page('Breadcrumb')}`);
const trailEl = elNav(`${elLink('Home')}${elSep()}${elLink('Components')}${elSep()}${elPage('Breadcrumb')}`);
const skeleton = (n) => nav(Array.from({ length: n }, (...[, i]) => `<ui-skeleton class="h-4 w-16 rounded-md animate-pulse bg-primary/10"></ui-skeleton>${i < n - 1 ? '<ui-skeleton class="size-3.5 rounded-md animate-pulse bg-primary/10"></ui-skeleton>' : ''}`).join(''));
const WIDTH = 'display:block;width:480px;';
export default {
    name: 'breadcrumb',
    items: [
        { id: 'trail', wrap: WIDTH, ref: trail, el: trailEl },
        { id: 'ellipsis-and-custom-separator', wrap: WIDTH, ref: nav(`${link('Home')}${sep('/')}${item(ellipsis())}${sep('/')}${link('Components')}${sep('/')}${page('Breadcrumb')}`), el: elNav(`${elLink('Home')}${elSep('/')}<ge-breadcrumb-item><ge-breadcrumb-ellipsis></ge-breadcrumb-ellipsis></ge-breadcrumb-item>${elSep('/')}${elLink('Components')}${elSep('/')}${elPage('Breadcrumb')}`) },
        { id: 'simple', wrap: WIDTH, ref: simpleRef(ENTRIES), el: simpleEl('b1') },
        { id: 'skeleton', wrap: WIDTH, ref: skeleton(3), el: '<ge-breadcrumb><ge-breadcrumb-list skeleton></ge-breadcrumb-list></ge-breadcrumb>' },
        { id: 'wraps', wrap: 'display:block;width:150px;', ref: trail, el: trailEl },
        { id: 'rtl', wrap: WIDTH, ref: `<div dir="rtl">${trail}</div>`, el: `<div dir="rtl">${trailEl}</div>` },
        { id: 'focus-link', wrap: WIDTH, focus: { ref: 'a', el: 'ge-breadcrumb-link' }, ref: trail, el: trailEl },
        { id: 'density-1.5', wrap: `${WIDTH}--density:1.5;`, ref: nav(`${link('Home')}${sep()}${item(ellipsis())}`), el: elNav(`${elLink('Home')}${elSep()}<ge-breadcrumb-item><ge-breadcrumb-ellipsis></ge-breadcrumb-ellipsis></ge-breadcrumb-item>`) },
    ],
};
