// Skeleton (html 335-342) and a custom empty state (html 313-333 with `emptyStateComponent`).
import { COLUMNS, elTable, refTable } from './data-table.mjs';

const skeleton = (rows) =>
    `<div class="flex flex-col w-full space-y-3" data-slot="data-table-skeleton"><ui-skeleton class="h-9 w-full rounded-md animate-pulse bg-primary/10"></ui-skeleton>${Array.from({ length: rows }, () => '<ui-skeleton class="h-12 w-full rounded-md animate-pulse bg-primary/10"></ui-skeleton>').join('')}<ui-skeleton class="h-9 w-full rounded-md animate-pulse bg-primary/10"></ui-skeleton></div>`;

const CUSTOM = '<div style="padding:24px;color:var(--muted-foreground)">Nothing to show</div>';
const customEmpty = refTable({ empty: true }).replace(/(<ui-table-cell class="[^"]*h-48[^"]*"[^>]*>).*?(<\/ui-table-cell>)/, `$1${CUSTOM}$2`);

export default {
    name: 'data-table-states',
    isolated: true,
    width: 700,
    items: [
        { id: 'skeleton-3', wrap: 'width:100%;', ref: skeleton(3), el: '<ge-data-table skeleton skeleton-rows="3"></ge-data-table>' },
        { id: 'skeleton-default', wrap: 'width:100%;', ref: skeleton(5), el: '<ge-data-table skeleton></ge-data-table>' },
        { id: 'empty-custom', wrap: 'width:100%;', ref: customEmpty, el: elTable({ columns: COLUMNS, props: { data: [] } }).replace('</ge-data-table>', `${CUSTOM.replace('<div', '<div slot="empty"')}</ge-data-table>`) },
    ],
};
