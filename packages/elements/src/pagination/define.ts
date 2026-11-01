import { defineElement } from '@gilav21/elements-base';
import { GePagination } from './pagination.js';
import { GePaginationContent } from './sub/pagination-content.js';
import { GePaginationEllipsis } from './sub/pagination-ellipsis.js';
import { GePaginationItem } from './sub/pagination-item.js';
import { GePaginationLink } from './sub/pagination-link.js';
import { GePaginationNext } from './sub/pagination-next.js';
import { GePaginationPrevious } from './sub/pagination-previous.js';

defineElement('pagination', GePagination);
defineElement('pagination-content', GePaginationContent);
defineElement('pagination-item', GePaginationItem);
defineElement('pagination-link', GePaginationLink);
defineElement('pagination-previous', GePaginationPrevious);
defineElement('pagination-next', GePaginationNext);
defineElement('pagination-ellipsis', GePaginationEllipsis);
export { GePagination, GePaginationContent, GePaginationEllipsis, GePaginationItem, GePaginationLink, GePaginationNext, GePaginationPrevious };
