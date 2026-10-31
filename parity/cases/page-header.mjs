import { ref as buttonRef } from '../lib/button-ref.mjs';
// shadcn-angular page-header.component.html and .ts
const BREADCRUMB = 'mb-2 flex flex-wrap items-center gap-2 empty:hidden';
const ROW = 'flex flex-wrap items-start justify-between gap-x-4 gap-y-3 max-sm:flex-col';
const BLOCK = 'min-w-0 flex-1 basis-64 space-y-1 max-sm:w-full max-sm:basis-auto';
const H = 'scroll-m-20 break-words text-2xl font-semibold tracking-tight sm:text-3xl';
const P = 'break-words text-sm text-muted-foreground';
const ACTIONS = 'flex flex-wrap items-center gap-2 shrink-0';
const ref = (crumb, level, title, desc, actions) =>
    `<ui-page-header class="block w-full"><div class="${BREADCRUMB}">${crumb}</div><div class="${ROW}"><div class="${BLOCK}"><h${level} class="${H}">${title}</h${level}><p class="${P}">${desc}</p></div><div class="${ACTIONS}">${actions}</div></div></ui-page-header>`;
const ACT_REF = buttonRef('outline', 'default', 'Export') + buttonRef('default', 'default', 'New');
const ACT = '<ge-button variant="outline">Export</ge-button><ge-button>New</ge-button>';
const W = 'width:600px;';
export default {
    name: 'page-header',
    items: [
        { id: 'basic', wrap: W, ref: ref('', 1, 'Invoices', 'Manage and send invoices.', ACT_REF), el: `<ge-page-header heading="Invoices" description="Manage and send invoices.">${ACT}</ge-page-header>` },
        { id: 'breadcrumb-h2', wrap: W, ref: ref('<nav data-slot="breadcrumb">Home / Billing</nav>', 2, 'Invoices', 'Manage and send invoices.', ACT_REF), el: `<ge-page-header heading="Invoices" heading-level="2" description="Manage and send invoices."><nav slot="breadcrumb">Home / Billing</nav>${ACT}</ge-page-header>` },
        { id: 'wraps-narrow', wrap: 'width:340px;', ref: ref('', 1, 'Quarterly revenue and expense report', 'Everything in one place.', ACT_REF), el: `<ge-page-header heading="Quarterly revenue and expense report" description="Everything in one place.">${ACT}</ge-page-header>` },
    ],
};
