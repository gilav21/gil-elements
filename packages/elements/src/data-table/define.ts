import { defineElement } from '@gilav21/elements-base';
import { GeDataTable } from './data-table.js';
import { GeDataTableColumnHeader } from './sub/data-table-column-header.js';
import { GeDataTablePager } from './sub/data-table-pager.js';

defineElement('data-table', GeDataTable);
defineElement('data-table-column-header', GeDataTableColumnHeader);
defineElement('data-table-pager', GeDataTablePager);
