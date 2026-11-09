/**
 * The rows of the body and the view of the row list they read. Package A (rows) owns this file. A row is drawn from
 * `body.items.slice(window.start, window.end)`. Two counters run side by side and are never the same thing:
 * `data-row-index` is the DRAWN index of a data row (group headers and detail rows are not counted; it addresses
 * `renderedRowAt(i)` in every mode), `aria-rowindex` is the ordinal of every real row (group headers, detail rows and
 * data rows alike), starting at the first item of the list (detail rows above the window included).
 */
import { html, nothing, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { treeRowAria } from './data-table-aria.js';
import { cellText, styleText } from './data-table-cells.js';
import { resolveCellKind } from './data-table-cell-kind.js';
import { componentCell } from './data-table-component-cell.js';
import { cellVarsStyle } from './data-table-columns.js';
import { allNodesExpanded, type Flags, isFlagged, treeHostKey } from './data-table-expansion.js';
import { isGroupingActive } from './data-table-group.js';
import type { BodyView, GridView } from './data-table-grid.js';
import { detailId, specialCell, treeHostCell } from './data-table-grid-special.js';
import { requireProvider } from './data-table-host.js';
import { chromeIcon, ensureIconElement } from './data-table-icons.js';
import type { FormattingService } from './data-table-providers.js';
import { columnParts, columnSpacer } from './data-table-grid-window.js';
import { memoLast } from './data-table-query.js';
import type { GetChildren } from './data-table-tree.js';
import { retainedTopOf } from './data-table-virtual.js';
import { type DataTableViewHost, dataRowOf } from './data-table-view.js';
import type { ColumnDef, DataTableDisplayRow, EnhancedColumnDef, FlattenedTreeRow, GroupRow } from './data-table.types.js';
import { getCellValue, isSpecialColumnKey, specialSlotOf, stringifyValue } from './data-table.utils.js';

export interface RowsView<T> {
    /** The body list before windowing: the rows of the page as drawn (the whole sorted or visible list under virtual scroll). */
    source: Pick<BodyView<T>, 'mode' | 'items'>;
    /** Real rows of that list for `aria-rowcount`: group headers and detail rows count, a window does not shrink it. */
    totalRows: number;
    /** The indexes (ascending) in `source.items` of the rows with an open detail row. */
    openDetails: readonly number[];
    /** `aria-multiselectable`, `aria-selected` and the select column are drawn. */
    selectable: boolean;
    selection: Readonly<Record<string, boolean>>;
    expanded: Readonly<Record<string, boolean>>;
    getRowId(row: T): string;
    isDisabled(row: T): boolean;
    formatting: FormattingService<T> | undefined;
    /** The empty state: a `renderEmpty` result, or the consumer's `empty` slot node. */
    empty: unknown;
    /** Per-table id part of a detail row's `id`. */
    uid: string;
    /** A cell-interaction controller exists: the grid keeps one tab stop, so in-cell controls leave the tab order. */
    roving: boolean;
    /** `enable-row-expansion`: an open row is followed by its detail row. */
    detail: boolean;
    renderDetail: ((row: T) => unknown) | undefined;
    /** Answers what a row that spans every column draws, or `undefined` / `null` / `false` for an ordinary row. */
    renderFullWidth: ((row: T) => unknown) | undefined;
    /** The key of the tree-host column (expander and indentation), or null outside tree mode. */
    treeHost: string | null;
    selectionHeader: { checked: boolean; indeterminate: boolean };
    /** Every filtered row's detail row is open (header expander). */
    allExpanded: boolean;
    /** Every node with children is open (tree-host header). */
    allSubRowsExpanded: boolean;
    isIndeterminate(id: string): boolean;
}

type BodyItem<T> = DataTableDisplayRow<T> | FlattenedTreeRow<T>;

/** The data row of a body item, or `undefined` for a group header. */
const rowOf = <T>(item: BodyItem<T>): T | undefined => dataRowOf(item);

const uids = new WeakMap<object, string>();
let nextUid = 0;
const uidOf = (owner: object): string => {
    let uid = uids.get(owner);
    if (uid === undefined) uids.set(owner, (uid = String(++nextUid)));
    return uid;
};

const NO_INDEXES: readonly number[] = [];

/** The item indexes, ascending, whose row has an open detail row. */
function openDetailIndexes<T>(items: readonly BodyItem<T>[], expanded: Flags, getRowId: (row: T) => string): number[] {
    const open: number[] = [];
    items.forEach((item, i) => {
        const row = rowOf(item);
        if (row !== undefined && isFlagged(expanded, getRowId(row))) open.push(i);
    });
    return open;
}

/** Per table, so two tables never evict each other: the scans a render would repeat while only the scroll position moved. */
const memos = new WeakMap<object, { open: typeof openDetailIndexes<unknown>; allNodes: typeof allNodesExpanded<unknown> }>();
const memosOf = (owner: object) => {
    let memo = memos.get(owner);
    if (!memo) memos.set(owner, (memo = { open: memoLast(openDetailIndexes<unknown>), allNodes: memoLast(allNodesExpanded<unknown>) }));
    return memo;
};

/** How many entries of the ascending `indexes` are below `n`. */
function countBelow(indexes: readonly number[], n: number): number {
    let low = 0;
    let high = indexes.length;
    while (low < high) {
        const mid = (low + high) >> 1;
        if ((indexes[mid] as number) < n) low = mid + 1;
        else high = mid;
    }
    return low;
}

export function rowsView<T>(host: DataTableViewHost<T>): RowsView<T> {
    const query = requireProvider(host, 'query');
    const { config, model } = host;
    const tree = config.enableSubRows;
    const grouped = isGroupingActive(config.groupBy, tree, host.provider('virtual')?.active() ?? false);
    const items: BodyView<T>['items'] = tree ? query.treeRows() : query.displayRows();
    const expanded = model.get('expandedRows');
    const selection = host.provider('selection');
    const detail = config.enableRowExpansion;
    const memo = memosOf(host.root);
    const getRowId = config.getRowId as (row: unknown) => string;
    const openDetails = detail ? memo.open(items as readonly BodyItem<unknown>[], expanded, getRowId) : NO_INDEXES;
    return {
        source: { mode: tree ? 'tree' : grouped ? 'group' : 'flat', items },
        totalRows: items.length + openDetails.length,
        openDetails,
        selectable: config.enableRowSelection,
        selection: model.get('rowSelection'),
        expanded,
        getRowId: (row) => config.getRowId(row),
        isDisabled: (row) => host.isDisabled(row),
        formatting: host.provider('formatting'),
        empty: items.length === 0 ? (host.renderEmpty?.() ?? host.slottedNodes('empty')) : undefined,
        uid: uidOf(host.root),
        roving: host.provider('interaction') !== undefined,
        detail,
        renderDetail: host.renderDetail,
        renderFullWidth: host.renderFullWidth,
        treeHost: tree ? treeHostKey(requireProvider(host, 'columns').enhancedColumns()) : null,
        selectionHeader: config.enableRowSelection ? (selection?.header() ?? { checked: false, indeterminate: false }) : { checked: false, indeterminate: false },
        allExpanded: detail && (host.provider('expansion')?.isAllExpanded() ?? false),
        allSubRowsExpanded: tree && memo.allNodes(model.get('data'), getRowId, config.getChildren as GetChildren<unknown>, model.get('subRowExpandedRows'), config.subRowDefaultExpanded ? -1 : 0),
        isIndeterminate: (id) => selection?.isIndeterminate(id) ?? false,
    };
}

function formattedText<T>(v: GridView<T>, c: ColumnDef<T>, row: T): unknown {
    const fmt = v.formatting?.cell(c, row);
    const text = cellText(c, row);
    if (!fmt) return text;
    const icon = fmt.icon;
    return html`<span data-slot="cell-formatted" class=${fmt.class} style=${styleText(fmt.style)}>${fmt.dataBar
        ? html`${fmt.dataBar.track ? html`<span data-slot="cell-data-bar-track" style=${`background-color:${fmt.dataBar.track}`}></span>` : nothing}<span data-slot="cell-data-bar" style=${`width:${fmt.dataBar.width};background-color:${fmt.dataBar.color}`}></span>`
        : nothing}${icon?.name
        ? (ensureIconElement(), html`<ge-icon data-slot="cell-icon" name=${icon.name} size="xs" class=${icon.class ?? ''}></ge-icon>`)
        : icon?.glyph
          ? html`<span data-slot="cell-icon" class=${icon.class ?? ''}>${icon.glyph}</span>`
          : nothing}<span data-slot="cell-text">${text}</span></span>`;
}

function plainContent<T>(v: GridView<T>, c: EnhancedColumnDef<T>, row: T, rowIndex: number): unknown {
    switch (resolveCellKind(c)) {
        case 'tag':
            return componentCell(c.component as string, c.componentInputs?.(row), c.componentOutputs?.(row));
        case 'renderer':
            return c.cellRenderer?.({ row, value: getCellValue(row, c.accessorKey, c), column: c, rowIndex });
        default:
            return formattedText(v, c, row);
    }
}

function cellContent<T>(v: GridView<T>, c: EnhancedColumnDef<T>, row: T, rowIndex: number, node: FlattenedTreeRow<T> | undefined): unknown {
    const special = specialCell(v, c, row);
    if (special !== undefined) return special;
    const content = plainContent(v, c, row, rowIndex);
    return node && String(c.accessorKey) === v.treeHost ? treeHostCell(v, node, content) : content;
}

function bodyCell<T>(v: GridView<T>, c: EnhancedColumnDef<T>, n: number, row: T, rowIndex: number, node: FlattenedTreeRow<T> | undefined): TemplateResult {
    const key = String(c.accessorKey);
    const focused = v.focusedCell?.rowIndex === rowIndex && v.focusedCell.columnKey === key;
    return html`<div data-slot="table-cell" role="gridcell" aria-colindex=${v.aria.colIndex(n)} data-column=${key} data-row-index=${rowIndex}
        data-width=${c._width === 'auto' ? 'auto' : 'fixed'} data-pinned=${c._pin ?? nothing} data-special=${isSpecialColumnKey(key) ? specialSlotOf(c) : nothing}
        data-border tabindex=${focused ? '0' : nothing} ?data-focused=${focused} style=${cellVarsStyle(c, n)}>${cellContent(v, c, row, rowIndex, node)}</div>`;
}

const filler = html`<div data-slot="table-cell" role="presentation" aria-hidden="true" data-border></div>`;

/** A cell that spans the whole row (full-width rows, detail rows, group headers): not an addressable data cell, and it takes only the bottom border (data-table.css). */
const wideCell = <T>(v: GridView<T>, content: unknown): TemplateResult =>
    html`<div data-slot="table-cell" role="gridcell" aria-colspan=${v.aria.colCount} data-width="full">${content}</div>`;

const claims = (value: unknown): boolean => value !== undefined && value !== null && value !== false;

/** The inline style of a data row: its tree depth, and for a row kept drawn outside the window its offset (package B: window). */
function rowStyle<T>(node: FlattenedTreeRow<T> | undefined, retainedTop: number | undefined): string | typeof nothing {
    const style = `${node ? `--ge-dt-depth:${node.depth};` : ''}${retainedTop === undefined ? '' : `--ge-dt-retained-top:${retainedTop}px`}`;
    return style || nothing;
}

function dataRow<T>(v: GridView<T>, row: T, i: number, ordinal: number, node: FlattenedTreeRow<T> | undefined, retainedTop?: number): TemplateResult {
    const id = v.getRowId(row);
    const selected = v.selection[id] === true;
    const disabled = v.isDisabled(row);
    const level = node ? treeRowAria(node) : null;
    const wide = v.renderFullWidth?.(row);
    return html`<div data-slot="table-row" role="row" aria-rowindex=${v.aria.dataRowIndex(ordinal)} aria-selected=${v.selectable ? String(selected) : nothing}
        aria-level=${level?.level ?? nothing} aria-expanded=${level?.expanded == null ? nothing : String(level.expanded)} aria-setsize=${node?.setSize ?? nothing} aria-posinset=${node?.posInSet ?? nothing}
        data-kind="data" data-row-index=${i} data-row-id=${id} data-depth=${node?.depth ?? nothing} style=${rowStyle(node, retainedTop)} ?data-retained=${retainedTop !== undefined}
        data-state=${selected ? 'selected' : nothing} ?data-disabled=${disabled} aria-disabled=${disabled ? 'true' : nothing}>
        ${claims(wide) ? wideCell(v, wide) : html`${columnParts(v.columns, v.body.window).map((p) => ('spacer' in p ? columnSpacer(p.spacer) : bodyCell(v, p.column, p.n, row, i, node)))}${v.hasFlexible ? nothing : filler}`}
    </div>`;
}

function safeJson(value: unknown): string {
    try {
        return JSON.stringify(value, null, 2) ?? String(value);
    } catch {
        return String(value);
    }
}

/** The row after an open data row: one full-width cell with `renderDetail`'s content, else the row as JSON. */
function detailRow<T>(v: GridView<T>, row: T, id: string, i: number, ordinal: number): TemplateResult {
    const content = v.renderDetail?.(row) ?? html`<pre data-slot="data-table-detail-json">${safeJson(row)}</pre>`;
    return html`<div data-slot="table-row" role="row" id=${detailId(v.uid, id)} aria-rowindex=${v.aria.dataRowIndex(ordinal)} data-kind="detail" data-detail-for=${i} data-row-id=${id}>${wideCell(v, content)}</div>`;
}

/** A group header: only its toggle button is focusable (a click anywhere on the row toggles too, through the delegated listener). */
function groupRow<T>(v: GridView<T>, group: GroupRow, ordinal: number): TemplateResult {
    const open = !group.collapsed;
    const label = group.groupValue === null || group.groupValue === undefined ? '' : stringifyValue(group.groupValue);
    const header = (key: string): string => v.columns.find((c) => String(c.accessorKey) === key)?.header ?? key;
    return html`<div data-slot="table-row" role="row" aria-rowindex=${v.aria.dataRowIndex(ordinal)} data-kind="group" data-group-key=${group.groupKey} aria-expanded=${open ? 'true' : 'false'}>
        ${wideCell(
            v,
            html`<div data-slot="data-table-group-label"><button type="button" data-slot="data-table-icon-button" data-toggle aria-label=${open ? v.locale.collapseGroup : v.locale.expandGroup} aria-expanded=${open ? 'true' : 'false'}>${chromeIcon('chevron-right', 'xs')}</button><span data-slot="data-table-text">${label}</span><span data-slot="data-table-group-meta">(${group.count})</span>${[...group.aggregates].map(([key, value]) => html`<span data-slot="data-table-group-meta">${header(key)}: ${value}</span>`)}</div>`,
        )}
    </div>`;
}

function emptyRow<T>(v: GridView<T>): TemplateResult {
    return html`<div data-slot="table-row" role="row" data-kind="empty" aria-rowindex=${v.aria.dataRowIndex(0)}>
        <div data-slot="table-cell" role="gridcell" data-kind="empty" aria-colspan=${v.aria.colCount} data-width="full">${v.empty ?? html`<div data-slot="data-table-empty-content">${chromeIcon('circle-off', 'xl')}<p>${v.locale.noResultsLabel}</p></div>`}</div>
    </div>`;
}

/** The decorative last row of the body (Angular's stretching row): `aria-hidden`, never counted. */
function spacerRow<T>(v: GridView<T>): TemplateResult {
    return html`<div data-slot="table-row" data-kind="spacer" aria-hidden="true">${columnParts(v.columns, v.body.window).map((p) => ('spacer' in p ? columnSpacer(p.spacer) : html`<div data-slot="table-cell" data-width=${p.column._width === 'auto' ? 'auto' : 'fixed'} data-pinned=${p.column._pin ?? nothing} style=${cellVarsStyle(p.column, p.n)}></div>`))}</div>`;
}

/** The rows of the window as keyed templates: a group header, a data row, and the detail row of an open one. */
function entries<T>(v: GridView<T>): { key: string; template: TemplateResult }[] {
    const { items, window } = v.body;
    const out: { key: string; template: TemplateResult }[] = [];
    // The ordinal counts every real row above it, the detail rows of rows above the window included (`aria-rowcount` does).
    const ordinalOf = (item: number): number => item + countBelow(v.openDetails, item);
    let ordinal = ordinalOf(window.start);
    for (const [offset, item] of (items.slice(window.start, window.end) as readonly BodyItem<T>[]).entries()) {
        if ('kind' in item && item.kind === 'group') {
            out.push({ key: `g:${item.groupKey}`, template: groupRow(v, item, ordinal++) });
            continue;
        }
        const row = item.row;
        const index = 'kind' in item ? item.index : window.start + offset;
        const id = v.getRowId(row);
        out.push({ key: `r:${id}`, template: dataRow(v, row, index, ordinal++, 'kind' in item ? undefined : item) });
        if (v.detail && isFlagged(v.expanded, id)) out.push({ key: `d:${id}`, template: detailRow(v, row, id, index, ordinal++) });
    }
    // package B: window (rows kept drawn outside the window, e.g. the focused one, out of flow at their own offset)
    for (const i of window.retained) {
        const item = items[i] as BodyItem<T> | undefined;
        const row = item && dataRowOf(item);
        if (row === undefined || item === undefined) continue;
        out.push({ key: `r:${v.getRowId(row)}`, template: dataRow(v, row, i, ordinalOf(i), 'kind' in item ? undefined : item, retainedTopOf(window, i)) });
    }
    return out;
}

/** Everything inside `[data-slot=table-body]`: the rows of the window (or the empty state), then the stretching row. */
export function renderRows<T>(v: GridView<T>): TemplateResult {
    return html`${v.body.items.length === 0 ? emptyRow(v) : repeat(entries(v), (e) => e.key, (e) => e.template)}${spacerRow(v)}`;
}
