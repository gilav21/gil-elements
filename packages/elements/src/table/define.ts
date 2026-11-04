import { defineElement } from '@gilav21/elements-base';
import '../skeleton/define.js';
import { GeTable } from './table.js';
import { GeTableBody } from './sub/table-body.js';
import { GeTableCaption } from './sub/table-caption.js';
import { GeTableCell } from './sub/table-cell.js';
import { GeTableFooter } from './sub/table-footer.js';
import { GeTableHead } from './sub/table-head.js';
import { GeTableHeader } from './sub/table-header.js';
import { GeTableRow } from './sub/table-row.js';

defineElement('table', GeTable);
defineElement('table-header', GeTableHeader);
defineElement('table-body', GeTableBody);
defineElement('table-footer', GeTableFooter);
defineElement('table-row', GeTableRow);
defineElement('table-head', GeTableHead);
defineElement('table-cell', GeTableCell);
defineElement('table-caption', GeTableCaption);
