// The cell editors of shadcn-angular's data-table (html 207-290, `cellEditTpl`), laid over the table shell of data-table.mjs: a text
// editor, a rejected text editor (ring and `p.mt-0.5` message), a select editor and a checkbox editor. The element side opens them through
// `data-edit` (parity/run.mjs: `startEditing`, and with `data-edit-error` a validator that refuses every value and a commit). Static only:
// the date picker, custom editors and anything in a popover are not photographed (spec 5.2).
import { COLUMNS, ROWS, elTable, refTable } from './data-table.mjs';

// What an Angular app's Tailwind preflight gives a form control and the parity page does not have (it carries only box-sizing and
// line-height): the font family of the page, no margin, no padding of its own. Only what no class of the editor sets: an inline style
// would beat `px-1` and `text-sm`. The element's sheet sets the same on its editors.
const PREFLIGHT = 'font-family: inherit; font-weight: inherit; letter-spacing: inherit; color: inherit; margin: 0; padding-block: 0; border-radius: 0;';
const INPUT = 'w-full h-full bg-background border-0 outline-none text-sm px-1';
const RING = 'ring-1 ring-inset ring-destructive';

const textInput = (value, invalid) =>
    `<input data-edit-input type="text" class="${INPUT} select-text${invalid ? ` ${RING}` : ''}" style="${PREFLIGHT}" value="${value}"${invalid ? ' aria-invalid="true"' : ''}>`;

// D19 (wave 5): the message sits UNDER the input, so the row grows with it. Angular draws the `p` beside the input in the flex-row cell,
// which squeezes the input; the wrapping row here is that one decided difference, the input, the ring and the message are Angular's.
const rejected = (message) => `<div class="flex flex-wrap items-center min-w-0 flex-auto whitespace-normal">${textInput('&#8203;', true)}<p class="basis-full mt-0.5 mb-0 px-1 text-xs text-destructive" role="alert" data-slot="cell-edit-error">${message}</p></div>`;

const OPTIONS = ['Engineer', 'Designer', 'Manager', 'Analyst'];
const select = (value) => `<select data-edit-input class="${INPUT}" style="${PREFLIGHT}">${OPTIONS.map((o) => `<option value="${o}"${o === value ? ' selected' : ''}>${o}</option>`).join('')}</select>`;

// checkbox.mjs's reference of an Angular `ui-checkbox` (unchecked, checked).
const BOX = 'shrink-0 rounded-sm border border-primary shadow outline-none peer-focus-visible:ring-1 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50 flex items-center justify-center';
const CHECK = '<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>';
const checkbox = (checked) =>
    `<ui-checkbox class="contents"><div class="contents"><span class="relative inline-flex shrink-0"><input type="checkbox" class="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" ${checked ? 'checked' : ''}><span class="${BOX} ${checked ? 'bg-primary text-primary-foreground' : 'bg-background'}" data-slot="checkbox" aria-hidden="true">${checked ? CHECK : ''}</span></span></div></ui-checkbox>`;

const ACTIVE_ROWS = ROWS.map((r, i) => ({ ...r, active: i % 2 === 0 }));
const ACTIVE_COLUMNS = [...COLUMNS.filter((c) => c.accessorKey !== 'role'), { accessorKey: 'active', header: 'Active', width: '100px' }];

/** The reference table with the cell of row `rowIndex`, column `key` drawn by `html`. */
const editing = (rowIndex, key, html, { columns = COLUMNS, rows = ROWS } = {}) => refTable({ columns, rows: rows.map((r) => ({ ...r, active: String(r.active ?? '') })), cellHtml: (c, row) => (row.id === rows[rowIndex].id && c.accessorKey === key ? html : undefined) });

/** The element with column `key` editable (and `patch` on it), the editor of `rowIndex` opened by the runner. */
const el = (rowIndex, key, { patch = {}, columns = COLUMNS, rows = ROWS, error } = {}) =>
    elTable({ columns: columns.map((c) => (c.accessorKey === key ? { ...c, editable: true, ...patch } : c)), rows, attrs: `data-edit="${rowIndex},${key}"${error ? ` data-edit-error="${error}"` : ''}` });

// No caret blink and no focus ring on either side.
const W = 'width:100%; caret-color: transparent;';

const items = [
    { id: 'text-editor', wrap: W, ref: editing(1, 'name', textInput('Bob Stone', false)), el: el(1, 'name') },
    { id: 'text-editor-rejected', wrap: W, ref: editing(1, 'name', rejected('Name is required')), el: el(1, 'name', { error: 'Name is required' }) },
    {
        id: 'select-editor',
        wrap: W,
        ref: editing(2, 'role', select('Manager')),
        el: el(2, 'role', { patch: { editType: 'select', editOptions: OPTIONS.map((o) => ({ label: o, value: o })) } }),
    },
    {
        id: 'checkbox-editor',
        wrap: W,
        ref: editing(0, 'active', checkbox(true), { columns: ACTIVE_COLUMNS, rows: ACTIVE_ROWS }),
        el: el(0, 'active', { patch: { editType: 'checkbox' }, columns: ACTIVE_COLUMNS, rows: ACTIVE_ROWS }),
    },
];

export default { name: 'data-table-edit', isolated: true, width: 700, items };
