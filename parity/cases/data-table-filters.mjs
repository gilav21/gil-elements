// Wave 5 package A: the floating filter row (html 758-811), the header filter trigger (html 633-651), the toolbar's advanced-filter
// trigger (html 380-393) and the filter builder standalone (sub/data-table-filter-builder template), over the shell of data-table.mjs.
// Popover content is not photographed (not parity-safe); the builder is rendered on its own.
import { ref as button } from '../lib/button-ref.mjs';
import { COLUMNS, ROWS, elTable, refTable, rewrite } from './data-table.mjs';
import { BASE as INPUT_BASE, VARIANT as INPUT_VARIANT } from './input.mjs';

const HEAD = 'text-foreground ltr:text-left rtl:text-right font-medium flex-1 [&:has([role=checkbox])]:ltr:pr-0 [&:has([role=checkbox])]:rtl:pl-0 [&>[role=checkbox]]:translate-y-[2px]';
const ROW_CLASS = 'flex w-full min-w-max flex-shrink-0 hover:bg-muted/50 data-[state=selected]:bg-muted transition-colors';
const FILTER = '<path d="M3 5h18l-7 8.5V20l-4-2v-4.5z" />';
const X = '<path d="m6 6 12 12" /><path d="M18 6 6 18" />';
const svgIcon = (name, px, paths, { solid = false, cls = '' } = {}) =>
    `<ui-icon class="${cls}"><svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24" fill="${solid ? 'currentColor' : 'none'}" stroke="${solid ? 'none' : 'currentColor'}" stroke-width="${solid ? 0 : 2}" stroke-linecap="round" stroke-linejoin="round" class="ui-icon ui-icon-${name}" data-slot="icon">${paths}</svg></ui-icon>`;
/** tailwind-merge of the input's classes with the consumer's: `text-xs` drops `text-base` (the `md:` one stays). */
const input = (extra, placeholder) => `<ui-input class="contents"><input class="${INPUT_BASE.replace('text-base ', '')} ${INPUT_VARIANT.outline} ${extra}" type="text" placeholder="${placeholder}" data-slot="input"></ui-input>`;
const popover = (trigger) => `<ui-popover class="relative inline-block" data-slot="popover"><ui-popover-trigger class="contents"><span class="" data-slot="popover-trigger">${trigger}</span></ui-popover-trigger></ui-popover>`;
const cellStyle = (width) => {
    const auto = !width || width === 'auto';
    return `width: ${auto ? '0px' : width}; min-width: ${auto ? '80px' : width}; max-width: ${auto ? 'none' : width}; flex-shrink: ${auto ? 1 : 0}; flex-grow: ${auto ? 1 : 0}; flex-basis: ${auto ? '0px' : 'auto'};`;
};

// ---- 1. the floating filter row ----------------------------------------------------------------------------------------------------------

const FLOAT_COLUMNS = COLUMNS.map((c) =>
    c.accessorKey === 'name' || c.accessorKey === 'age' ? { ...c, enableFiltering: true } : c.accessorKey === 'role' ? { ...c, enableFiltering: true, floatingFilter: false } : c,
);
const floatCell = (c, value) =>
    `<ui-table-head class="flex items-center flex-shrink-0 ${HEAD} sticky top-[var(--header-height,41px)] z-20 bg-muted/50 py-1 px-1 overflow-hidden pointer-coarse:h-auto" data-slot="table-head" role="${c.enableFiltering && c.floatingFilter !== false ? 'columnheader' : 'presentation'}" style="${cellStyle(c.width)}">${
        c.enableFiltering && c.floatingFilter !== false ? input('h-7 text-xs', c.header).replace('data-slot="input"', `${value ? `value="${value}" ` : ''}data-slot="input"`) : ''
    }</ui-table-head>`;
function floating(filters, rows) {
    const base = refTable({ rows });
    const row = `<ui-table-row class="${ROW_CLASS} border-0" data-slot="table-row">${FLOAT_COLUMNS.map((c) => floatCell(c, filters[c.accessorKey])).join('')}</ui-table-row>`;
    return rewrite(base, /(<ui-table-header [^>]*>[\s\S]*?<\/ui-table-row>)(<\/ui-table-header>)/, `$1${row}$2`, 'floating row');
}
const FLOAT_FILTERS = { name: 'Al', age: '3' };

// ---- 2. the header filter trigger ------------------------------------------------------------------------------------------------------

const TRIGGER = 'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-8 w-8 pointer-coarse:size-11';
const trigger = (header, active) => popover(`<button class="${TRIGGER}${active ? ' text-primary' : ''}" aria-label="Filter ${header}">${svgIcon('filter', 16, FILTER, { solid: active })}</button>`);
const ROLE_PANEL = { accessorKey: 'role', header: 'Role', enableFiltering: true, filterComponent: 'x-parity-filter' };
function withTrigger(html, active) {
    return rewrite(html, /(data-column-id="role"[\s\S]*?<\/ui-data-table-column-header>)/, `$1${trigger('Role', active)}`, 'role trigger');
}
const triggerColumns = COLUMNS.map((c) => (c.accessorKey === 'role' ? ROLE_PANEL : c));

// ---- 3. the toolbar's advanced-filter trigger -------------------------------------------------------------------------------------------

const ADVANCED = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-3 h-8 pointer-coarse:h-11 pointer-coarse:min-w-11 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground';
function withToolbar(count) {
    const badge = count > 0 ? `<span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs text-primary-foreground">${count}</span>` : '';
    const toolbar = `<div class="flex flex-wrap items-center justify-between gap-2 flex-none"><div class="flex flex-1 flex-wrap items-center gap-2">${input('h-8 w-full sm:w-[150px] lg:w-[250px]', 'Filter...')}${popover(`<button type="button" data-slot="advanced-filter-trigger" class="${ADVANCED}">${svgIcon('filter', 12, FILTER)}<span class="hidden sm:inline">Filter</span>${badge}</button>`)}</div></div>`;
    return rewrite(refTable(), /(<output [^>]*data-slot="data-table-announcer"><\/output>)/, `$1${toolbar}`, 'toolbar');
}
// The global filter input is not what these cases photograph, and its placeholder sits ~1px off Angular's (the lead's toolbar rule in
// data-table.css scales the input's padding with the density it uses for the 2rem height): its placeholder is hidden on both sides.
const HIDE_REF_PLACEHOLDER = '<style>input[data-slot="input"][placeholder="Filter..."]::placeholder{color:transparent}</style>';
const HIDE_EL_PLACEHOLDER = '<style>[data-slot="data-table-filter"] ge-input::part(input)::placeholder{color:transparent}</style>';
const toolbarEl = (group) => elTable({ attrs: 'show-toolbar="true" show-column-visibility-toggle="false" enable-advanced-filter', props: group ? { advancedFilter: group } : {} }).replace('show-toolbar="false" ', '');
const TWO = { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'name', operator: 'contains', value: 'zzz-never' }, { type: 'group', combinator: 'or', rules: [{ type: 'condition', column: 'role', operator: 'notEquals', value: 'zzz' }] }] };
const TWO_NOOP = { ...TWO, combinator: 'or', rules: [{ ...TWO.rules[0] }, TWO.rules[1]] };

// ---- 4. the builder, standalone ---------------------------------------------------------------------------------------------------------

const OPERATORS = [
    ['contains', 'contains'], ['notContains', 'does not contain'], ['equals', 'equals'], ['notEquals', 'not equals'], ['startsWith', 'starts with'], ['endsWith', 'ends with'],
    ['gt', 'greater than'], ['gte', 'greater or equal'], ['lt', 'less than'], ['lte', 'less or equal'], ['isEmpty', 'is empty'], ['isNotEmpty', 'is not empty'],
];
const BUILDER_COLUMNS = [{ key: 'name', header: 'Name' }, { key: 'role', header: 'Role' }];
const options = (list, selected) => list.map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join('');
function refCondition(rule) {
    const value = rule.operator === 'isEmpty' || rule.operator === 'isNotEmpty' ? '' : `<input type="text" placeholder="value" class="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm" value="${rule.value ?? ''}">`;
    return `<div class="flex items-center gap-1" data-slot="filter-condition"><select class="h-8 w-24 shrink-0 rounded-md border bg-background px-1 text-sm">${options(BUILDER_COLUMNS.map((c) => [c.key, c.header]), rule.column)}</select><select class="h-8 w-28 shrink-0 rounded-md border bg-background px-1 text-sm">${options(OPERATORS, rule.operator)}</select>${value}<button type="button" class="ms-auto inline-flex h-7 w-7 pointer-coarse:size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive" aria-label="Remove condition">${svgIcon('x', 12, X)}</button></div>`;
}
function refGroup(group) {
    const rules = group.rules
        .map((rule) => (rule.type === 'condition' ? refCondition(rule) : `<div class="border-s-2 ps-2" data-slot="filter-subgroup">${refGroup(rule)}<button type="button" class="mt-1 text-xs text-muted-foreground hover:text-destructive">Remove group</button></div>`))
        .join('');
    const and = group.combinator === 'and';
    return `<ui-data-table-filter-builder class="block"><div class="space-y-2 rounded-md border bg-background p-2" data-slot="filter-group"><div class="flex items-center gap-2"><div class="inline-flex shrink-0 overflow-hidden rounded-md border text-xs"><button type="button" class="px-2 py-1 pointer-coarse:min-w-11${and ? ' bg-accent' : ''}">AND</button><button type="button" class="px-2 py-1 border-s pointer-coarse:min-w-11${and ? '' : ' bg-accent'}">OR</button></div><span class="text-xs text-muted-foreground">${and ? 'match all of the rules below' : 'match any of the rules below'}</span></div>${rules}<div class="flex flex-wrap gap-2">${button('outline', 'sm', '+ Condition', { extra: 'pointer-coarse:h-11' })}${button('ghost', 'sm', '+ Group', { extra: 'pointer-coarse:h-11' })}</div></div></ui-data-table-filter-builder>`;
}
const esc = (value) => JSON.stringify(value).replaceAll('&', '&amp;').replaceAll("'", '&#39;');
const elBuilder = (group) => `<ge-data-table-filter-builder data-props='${esc({ group, columns: BUILDER_COLUMNS })}'></ge-data-table-filter-builder>`;
const BUILDER_TREE = {
    type: 'group',
    combinator: 'and',
    rules: [
        { type: 'condition', column: 'name', operator: 'contains', value: 'Al' },
        { type: 'group', combinator: 'or', rules: [{ type: 'condition', column: 'role', operator: 'isEmpty', value: 'kept' }, { type: 'condition', column: 'name', operator: 'equals', value: 'Bob' }] },
        { type: 'group', combinator: 'and', rules: [] },
    ],
};

const W = 'width:100%;';
const BW = 'width:420px;';
const filtered = ROWS.filter((r) => r.name.toLowerCase().includes('al') && String(r.age).includes('3'));
const items = [
    { id: 'floating-row', wrap: W, ref: floating(FLOAT_FILTERS, filtered), el: elTable({ columns: FLOAT_COLUMNS, attrs: 'enable-floating-filters', props: { columnFilters: FLOAT_FILTERS } }) },
    { id: 'floating-row-empty', wrap: W, ref: floating({}, ROWS), el: elTable({ columns: FLOAT_COLUMNS, attrs: 'enable-floating-filters' }) },
    { id: 'header-trigger-inactive', wrap: W, ref: withTrigger(refTable(), false), el: elTable({ columns: triggerColumns }) },
    { id: 'header-trigger-active', wrap: W, ref: withTrigger(refTable(), true), el: elTable({ columns: triggerColumns, props: { columnFilters: { role: 'n' } } }) },
    {
        id: 'header-trigger-sorted',
        wrap: W,
        ref: withTrigger(refTable({ sort: [{ column: 'role', direction: 'asc' }], rows: [...ROWS].sort((a, b) => a.role.localeCompare(b.role)) }), true),
        el: elTable({ columns: triggerColumns, sort: [{ column: 'role', direction: 'asc' }], props: { columnFilters: { role: 'n' } } }),
    },
    { id: 'advanced-trigger', wrap: W, ref: HIDE_REF_PLACEHOLDER + withToolbar(0), el: HIDE_EL_PLACEHOLDER + toolbarEl(null) },
    { id: 'advanced-trigger-badge', wrap: W, ref: HIDE_REF_PLACEHOLDER + withToolbar(2), el: HIDE_EL_PLACEHOLDER + toolbarEl(TWO_NOOP) },
    { id: 'builder', wrap: BW, ref: refGroup(BUILDER_TREE), el: elBuilder(BUILDER_TREE) },
    { id: 'builder-empty', wrap: BW, ref: refGroup({ type: 'group', combinator: 'or', rules: [] }), el: elBuilder({ type: 'group', combinator: 'or', rules: [] }) },
];

export default { name: 'data-table-filters', isolated: true, width: 700, items };
