# Porting shadcn-angular `ui-data-table` to gil-elements (`ge-data-table`)

Design document only. Nothing in `packages/` was changed to write it.

Angular reference: `D:\Development\shadcd\shadcn-angular\packages\components\ui\data-table\` (call it `AT/`).
Line numbers below are for `AT/data-table.component.ts` ("cmp") unless a file is named. Counts: cmp 6411, html 1531,
utils 814, types 487, locales 340, host 114, column-builder 80, spreadsheet 56, sub/* ~1100, addons ~800 (+ ~1500 spec).
Specs total ~13k lines / ~680 `it`s (main spec 7077 lines, 465 tests).

---

## 1. What the Angular component does

### 1.1 Feature inventory (with where it lives and what pins it)

| Area | Behaviour | Source | Pinned by |
|---|---|---|---|
| **Columns / definition** | `ColumnDef<T>`: accessorKey/accessorFn, `header`, `cell(row)=>string`, `template`/`component`(+inputs/outputs)/`headerTemplate`, width/minWidth (default 80px, specials 0px), sticky/pin, hiding/reordering flags, footer/aggregateFn, edit*, conditional formatting (cellClassRules, cellStyleRules, colorScale, dataBar, iconSet). Special keys `_selection`, `_expander`, `_actions`. `columnHelper<T>()` fluent builder. | types 21-146; `data-table-column-builder.ts` (80); cmp 2346-2526 (enhancedColumns, special columns, right offsets), 225-236 (min width) | `data-table-column-builder.spec` (11), main spec |
| **Sorting** | single and multi-sort (`enableMultiSort`, `maxMultiSortColumns`), per-column `sortFn`, local or server (`localSorting`), sort index badge, aria-sort, live-region announce. Tree sorts siblings only (`enableSubRowSorting`). | cmp 1134-1148, 2180-2346, 3887-3924; header sub 104 | main spec "sorting", `column-header.spec` (210) |
| **Filtering** | global filter (debounced `filterDebounce`, `globalFilterFn`, per-col `enableGlobalFilter`), per-column filters (text, `filterComponent`, floating filter row, date / date-range / multiselect filter sub-elements), `filterFn`, local or server. | cmp 1048-1062, 1183-1445, 3506-3542, 3846-3887, 2480-2526 | main spec, `date-filter.spec` (350), `multiselect-filter.spec` (232) |
| **Advanced filter** | AND/OR tree of `FilterCondition` (12 operators) edited in `data-table-filter-builder`; pure evaluator. | types 312-341; utils 733-771; cmp 1089-1130; sub/filter-builder (255) | `data-table-advanced-filter.spec` (25) |
| **Natural-language filter and AI fill** | `aiProvider` (BYO) compiles a query to `NlFilterSpec` (`parseNlFilterSpec` validates keys/operators); `aiFillColumn` fills a column from per-row prompts. No provider means no UI. | utils 16-50; cmp 1062-1089, 4881-4929 | `data-table-ai.spec` (15) |
| **Selection** | checkbox column, `rowSelection` (id->bool model), header tri-state, `isRowDisabled`/`disabledRowIds`, `selectRows/unselectRows/clearSelection/selectAll`, sub-row cascade modes `self/descendants/filteredDescendants` with indeterminate bubbling. | cmp 3277-3484, 5199-5338 | main spec, "Sub-Rows" block (2236-2867) |
| **Row expansion** | detail row via template/component, `expandedRows` model, expand-all tri-state. | cmp 3311-3404, html 162 | main spec |
| **Pagination** | local or server (`total`), page-size selector, `paginationState` model, `pageChange`; subcomponent. Paging counts only reachable rows (grouped/tree). Resets to page 0 on filter. | cmp 1148-1152, 1525-1585, 1674-1694, 1802-1828, 3484-3506; sub/pagination (150+80 html) | `pagination.spec` (147), "paging only what a pager can reach" (7032-7077) |
| **Virtual scroll** | rows + columns windowing, fixed or variable row heights (prefix sums, ResizeObserver feedback), `auto` threshold, buffer, recycle flag, scrollToRow/Column/Cell, aria-rowindex offset. | cmp 772-1000, 2100-2180, 6364-6411; utils 52-283 (`computeRowRange`, `computeColumnRange`, `buildPrefixSums`, `computeVariableRowRange`) | `data-table-virtual-scroll.spec` (190), main spec 5430-5558, 6054-6162 |
| **Tree / grouping / pivot** | tree via `getChildren/setChildren`, depth indent, default-expanded depth, filter modes, paginated roots; `buildTreeFromFlat`. `groupBy` with collapsible headers + aggregates, rendered-row-index semantics (group rows not counted). Pivot is an addon (`computePivot`). | cmp 1445-1700, 5020-5431, 5675-5727; utils 283-566, 657-733; `addons/pivot` (137 utils + directive) | main spec 2236-2867, 3087-3792 ("Row Grouping" is 700 lines), `pivot.directive.spec` (211) |
| **Editing** | dblclick/Enter/F2/touch open an editor (`text/number/select/checkbox/date` or `editComponent/editTemplate`), `editValidator`, `valueSetter`, commit/cancel, Tab advances, edit-error state, `cellEdit`/`editError` outputs, undo/redo stack (`enableEditHistory`) as commands. Date editor round-trips value shape. | cmp 4654-5020, 3714-3746, 4817-4880; utils 771-814; sub/date-utils | main spec 4482-4555, 6861-6993 (B3) |
| **Spreadsheet features** | cell range selection (drag, shift-click, touch long-press), range stats readout (count/sum/avg/min/max), range chart payload, fill handle (series detection `buildFillValues`), TSV/CSV paste (`parseClipboardGrid`, coercion, per-cell accept/reject), copy cell/row/selection/range with formula-injection guard. | cmp 2526-2766, 2959-3015, 4200-4270, 4311-4372, 4432-4580; utils 566-635; `data-table.spreadsheet.ts` | `data-table-fill.spec` (119), `data-table-paste.spec` (48), main spec 6444-6861 |
| **Column resize / reorder / pin / autofit** | drag resize (mouse + touch, RTL aware), dblclick autofit via DOM measuring, fit-to-viewport, column drag reorder, pin left/right overrides, show/hide popover. | cmp 3542-3700, 5431-5510, 6159-6364 | `data-table-autofit.spec` (159), main spec 5288-5430 |
| **Row drag reorder** | flat and tree (above/below/on, `rowDragAllowDrop`, auto-scroll, `reorderData` helper). | cmp 5727-6159 | main spec 4655-5288 (630 lines) |
| **View-state persistence** | `getColumnState/applyColumnState`, versioned `getViewState/applyViewState` (refuses unknown version), `currentQuery()` for server mode, `query` output. | types 187-310; cmp 3692-3836, 4164-4186 | `data-table-view-state.spec` (17), `data-table-query.spec` (10) |
| **Context menu** | addon: row/header/cell gestures (right click, long press, kebab slot), reads host. | `addons/context-menu` (362 + types) | `context-menu.directive.spec` (1107), `context-menu.table.spec` (191) |
| **Export** | addon: CSV (BOM, CRLF, guarded), XLSX via `lib/parsers/xlsx`, server `exportDataProvider(query)`, busy overlay. | `addons/export` (116 + locales) | `export.directive.spec` (318) |
| **Visual extras** | skeleton/loader (per-trigger visibility), cell flash on change, conditional formatting, footers/aggregates, full-width rows, empty state, theme, row/column borders. | cmp 354-396, 1711-1802, 3027-3106, 3945-4046, html throughout | main spec 4555-4655, 6222-6444 |
| **i18n** | `DataTableLocale` (en + 9 more) with `{column}` interpolation, optional keys fall back to English, RTL (`isRtl`). | `data-table.locales.ts` (340), cmp 1000-1048 | main spec 3792-3952 |
| **Grid ARIA** | `role=grid` (`treegrid` for tree), aria-rowcount/colcount/rowindex/colindex stamped after render, decorative spacer rows `aria-hidden`, roving tabindex focus ring, sort announcements via live region, multiselectable. | cmp 2806-2884, 2246-2275; html 283, 739-806 | `data-table-grid-semantics.spec` (244) |
| **Dev diagnostics** | `validateConfiguration` warns on 14 misconfigurations (pagination + virtual scroll, duplicate keys, edit without setter...). | cmp 1901-2082 | main spec 5571-5742 |
| **Addon host** | `DataTableAddonHost` abstract class (33 members), `AddonSlotRegistry` for kebab buttons. | `data-table.host.ts`, cmp 5523-5650 | `data-table.host.spec` (15), main spec 2867-2952 |
| **Sibling** | `data-table-range-chart` (106 ts, 199 spec lines) renders `RangeChartPayload`. `ui/table` is the structural primitive (we already have `ge-table*`). | `AT/../data-table-range-chart/` | its spec |

### 1.2 Observations that shape the port

- cmp is one class holding ~140 inputs/models/outputs, ~120 `computed`s and ~230 methods. The seams are already
  visible as banner-less clusters (see section 3.2); the pure kernels are already extracted to `utils.ts`.
- Roughly 35% of the logic is pure (filter/sort/tree/group/page pipeline, ranges, fill, paste, view state, query
  shape, aggregates) and could live in plain functions over `T[]`. In Angular it is mixed into `computed`s that read
  inputs, so wave 1 has to *extract* it, not copy it.
- `html` (1531 lines) is a single template with five render paths: normal, virtual, tree, grouped, skeleton, and
  pinned-left/middle/pinned-right section triplication for header, body and footer. Section 3.4 collapses this.

---

## 2. Angular-only constructs and the Lit mapping

| Angular | Used for | Lit equivalent |
|---|---|---|
| `input()`/`input.required()` | ~110 config inputs | `static properties` + reactive property, attribute for scalars (`show-toolbar`, `enable-multi-sort`, `page-size`) and property-only for objects/functions (`data`, `columns`, `getRowId`, `isRowDisabled`, `aiProvider`). We use `defaultTrue`-style converters from `shared/chart/chart-base.ts` for default-true booleans. |
| `model()` (two-way) | data, rowSelection, expandedRows, subRowExpandedRows, collapsedGroups, globalFilter, columnFilters, advancedFilter, sortState, multiSortState, paginationState, columnWidths/Visibility/Order | Controlled-with-internal-fallback property plus a `*-change` `CustomEvent` (detail = new value). Rule: the element owns state; a write via property wins over internal; every internal mutation fires the event. One helper `ModelProp<T>` in `data-table-model.ts` (get/set/emit/`peek`) so controllers never touch event plumbing. |
| `output()` | sortChange, pageChange, filterChange, query, cellEdit, editError, rowReorder, columnResize, cellsPaste, fillSeries, rangeChartOpen, editUndo/Redo, nlFilter, aiFillComplete | `CustomEvent`s with `ge-` free names: `sort-change`, `page-change`, `filter-change`, `query`, `cell-edit`, `edit-error`, `row-reorder`, `column-resize`, `cells-paste`, `fill-series`, `range-chart-open`, `edit-undo`, `edit-redo`, `nl-filter`, `ai-fill-complete`. All `bubbles: true, composed: true`, detail typed in `data-table.types.ts`. |
| `signal`/`computed`/`effect`/`afterRenderEffect` | derived pipeline, ARIA stamp, pagination reset, cell-flash | Memoised getters keyed on identity of inputs (`memo(() => fn, deps)`) inside the query controller, recomputed in `willUpdate(changed)`. Effects become `willUpdate`/`updated` branches. The grid-semantics effect disappears: we render `aria-*` attributes straight from the model (section 4.6). |
| `TemplateRef`, `Type<unknown>` for cell/header/edit/filter/footer/loader/detail/empty/full-width renderers; `componentInputs/Outputs` | custom cell content | Renderer functions: `cell?: (ctx: CellContext<T>) => unknown` returning `TemplateResult \| string \| Node`. `component`/`template` collapse to this single concept (`renderCell`, `renderHeader`, `renderEdit`, `renderFooter`, `renderFilter`, `renderDetail`, `renderEmpty`, `renderFullWidth`, `renderLoader`). Tag-name shortcut: `component: 'my-badge'` with `componentInputs(row)` applied as properties and `componentOutputs` as listeners, so the builder's `.component()` survives. Also support light-DOM slotted templates for HTML-only users (`<template slot="cell-status">`, cloned per row with `data-*` binding) as a later nicety, not wave 1-6. |
| Content projection / `ng-content` | toolbar extras, empty state | Named slots: `toolbar-start`, `toolbar-end`, `empty`, `loading`, `footer`. |
| `inject(DataTableAddonHost)` DI token; `exportAs` directives attached to the table in the template (`[uiDtExport]`) | addons | Provider hook, as in the RTE (`rich-text-providers.ts`): addons are plain factories `(host: DataTableAddonHost, options) => teardown` registered with `table.use(addon)` or auto-attached via child elements (`<ge-data-table-export for="t1">`). Export/pivot expose imperative methods through a returned controller object. See 3.5. |
| `ChangeDetectionStrategy.OnPush`, `ChangeDetectorRef` | perf | Lit already re-renders only on property change. The cost is the opposite: we must avoid re-running the O(n) pipeline on unrelated updates, so memo keys matter (3.3). |
| `host: { ... }` bindings, `hostClasses` | block h-full w-full | `:host { display:block; height:100% }` in css. `class` input is dropped (plain `class` attribute). |
| `ViewChild`, `ElementRef`, `DOCUMENT` | DOM lookups | `this.renderRoot.querySelector`, `this.ownerDocument`. SSR guard on every use (SSR-safe rule). |
| `ResizeObserver` presence checks (`hasResizeObserver`, 211) | | Keep: `typeof ResizeObserver` guard; node-test with a fake. |
| `LocaleInput<T>`/`createLocaleBindings` | locale | `locale` property accepting a code or dictionary; `pickLocale` from `shared/locale-lookup.ts`; dictionaries opt-in (3.5, 5.2). |
| `ThemeName` input | theme presets | Reuse `shared/theme-presets.ts`. |
| `@angular/cdk`-like drag (native DnD events used directly) | row/column drag | Native HTML5 DnD is DOM-only and ports 1:1. Touch row-drag is not supported in Angular either; keep the same. `shared/sortable-registry.ts` is a different mechanism (pointer sortable); evaluate in wave 6 but do not force it. |
| Reused Angular components inside the template (`ui-checkbox`, `ui-popover`, `ui-select`, `ui-date-picker`, `ui-input`, `ui-skeleton`, `ui-button`) | | Our `ge-checkbox`, `ge-popover`, `ge-select`, `ge-date-picker`, `ge-input`, `ge-skeleton`, `ge-button`. Not `ge-dropdown-menu`; the column "⋮" menu uses `shared/menu.ts` + `shared/overlay.ts` inside the header sub-element. |
| `lib/parsers/xlsx` `generateXlsx` | export addon | Lives in shadcn lib; we need either a port into `packages/elements/src/shared/xlsx.ts` (~300 lines, only the export addon imports it) or CSV-only first. Decision in 5.5. |
| `AiProvider` (RxJS Observable in Angular) | | `shared/ai.ts` already has the async-iterable version and tasks `table-fill`, `nl-filter`; reuse unchanged. |

---

## 3. Proposed architecture

### 3.1 Element layout (`packages/elements/src/data-table/`)

Shadow DOM for the root (consistent with `ge-table`, `ge-virtual-scroll`) because the stylesheet is big and must not
leak; row/cell content produced by renderer functions is rendered **into the shadow tree** (lit `html`), and consumers
style it through `::part()` and CSS custom properties (listed in 3.7). Light-DOM custom content is slotted
(`slot="empty"` etc.).

Elements:

- `ge-data-table` (root, `data-table.ts`): config, state, orchestration, renders toolbar + grid + pager.
- `ge-data-table-column-header` (`sub/column-header.ts`): sort button, filter trigger, resize handle, kebab, drag
  handle. Light on its own state, emits `sort-request`, `resize-start`, etc., reads column via property.
- `ge-data-table-filter-popover` family: `sub/date-filter.ts`, `sub/date-range-filter.ts`,
  `sub/multiselect-filter.ts`, `sub/filter-builder.ts` (builder is a pure-view over `FilterGroup`).
- `ge-data-table-pager` (`sub/pagination.ts`): composes our existing `ge-pagination` primitives, plus select for page
  size. Does not reimplement paging maths.
- Reuse: `ge-table-*` is **not** used for the grid body (see 3.4); the root renders its own flex rows with the same
  tokens so cells align by construction. `ge-table-*` parts remain usable by consumers for static tables.
- `ge-data-table-range-chart` (separate entry point `data-table/range-chart`), wraps our chart elements in
  `shared/chart/*`.

Non-visual files (all in `data-table/`):

```
data-table.types.ts            // types adapted for Lit (no TemplateRef/Type)
data-table.utils.ts            // pure kernels from utils.ts
data-table.locales.ts          // en only + DataTableLocale interface
data-table-column-builder.ts   // fluent builder, renderer-function based
data-table-query.ts            // filter/sort/page/group pipeline, pure
data-table-tree.ts             // flatten, cascade, reorder, buildTreeFromFlat
data-table-virtual.ts          // window maths; reuses virtual-scroll/virtual-axis.ts
data-table-view-state.ts       // column/view state read/apply, query shape
data-table-spreadsheet.ts      // formula guard + restore (as is)
data-table-range.ts            // range normalisation, stats, chart payload, fill, paste coercion
data-table-host.ts             // DataTableCoreHost, DataTableAddonHost, controller contract
data-table-registry.ts         // thin re-export of the RTE primitives (see 3.6)
data-table-controllers.ts      // ordered factory list (mirrors RICH_TEXT_CONTROLLERS)
data-table-<name>.ts           // one file per controller, with its own *.browser.test.ts
locales/*.ts                   // opt-in dictionaries
addons/{context-menu,export,pivot}/...
```

### 3.2 Host contract and controllers

Pattern copied from the RTE: a `DataTableCoreHost` interface is the only thing controllers see; the element implements
it. Controllers implement `{ attach(): void; detach(): void; hostUpdate?(changed): void; renderXxx?(): TemplateResult | null }`.
Construction order is explicit in `data-table-controllers.ts`, with the same "why this order" comment block.

```ts
interface DataTableCoreHost<T> extends ReactiveControllerHost {
  readonly config: DataTableConfig<T>;                 // live reads of every input, never snapshots
  readonly model: ModelStore;                          // sortState, selection, ... (get/set/emit)
  readonly query: QueryView<T>;                        // memoised pipeline outputs, see below
  readonly columns: ColumnView<T>;                     // enhanced/ordered/pinned columns
  readonly root: HTMLElement;                          // scroll container
  emit<K extends keyof DataTableEvents>(name: K, detail: DataTableEvents[K]): void;
  announce(message: string): void;                     // aria-live
  schedule(task: () => void): void;                    // after next paint (focus, measure)
  readonly locale: DataTableLocale;
  readonly disposables: Disposables;
  topics: TopicBus<'rows'|'columns'|'selection'|'range'|'edit'|'locale'|'viewport'>;
}
```

Controllers (number is the Angular range it absorbs; est. = Lit lines incl. render parts, excl. tests):

| # | Controller (file) | Owns | From cmp lines | Est. |
|---|---|---|---|---|
| 1 | `ColumnsController` | enhancedColumns, special columns, pin overrides and right-offset maths, min width, visibility, order, widths, hideable list, column popover | 225-236, 2346-2526, 3542-3592, 3692-3714, 3791-3836, 5431-5510, 5563-5675 | 450 |
| 2 | `QueryController` | memo graph: advanced -> global -> column filters -> sort -> page; tree variants; grouped rows; `activeTotalItems`; server vs local; `currentQuery()`/`queryState()`; `query` event; debounce | 1183-1700 (≈520), 2180-2346, 3484-3542, 3868-3924, 4123-4186 | 600 |
| 3 | `SelectionController` | row selection, disabled rows, expand/detail rows, select-all/indeterminate, sub-row cascade/bubbling | 3277-3484, 5199-5338 | 350 |
| 4 | `TreeController` | expand/collapse, depth/path, flatten for page, find parent/children, tree row drag reorder data transforms | 5020-5199, 5338-5431, 5976-6071 | 400 |
| 5 | `GroupingController` | group partition, collapse, aggregates labels, rendered-row-index renumber | 1585-1694, 5675-5727 | 180 |
| 6 | `VirtualController` | enable/auto threshold, window computation (rows+cols+variable heights), ResizeObserver, padding spacers, scroll handler, row-height feedback, `scrollTo*` | 772-1000, 2100-2180, 6364-6411 | 450 |
| 7 | `FocusController` (grid nav) | focused cell, roving tabindex, key navigation (arrows/Home/End/PgUp/PgDn/Ctrl+Home/End), ensure visible, reconcile after row set changes | 2884-2959, 4272-4311, 4467-4474, 4579-4654 | 350 |
| 8 | `RangeController` | range selection (mouse + touch long-press), stats readout, chart payload, fill handle + preview | 2526-2766, 2959-3027, 4311-4374, 1874-1900 | 450 |
| 9 | `EditController` | editor lifecycle, validation, commit/cancel, tab advance, date editor adapter, undo/redo command stack, edit-error | 3714-3746, 4654-5020 | 550 |
| 10 | `ClipboardController` | copy cell/row/selection/range/all, paste (keyboard + `navigator.clipboard`), `cells-paste` event, guarded TSV | 2696-2766, 4200-4272, 4432-4443, 4474-4579 | 350 |
| 11 | `ResizeController` | column resize (mouse/touch/RTL), autofit, fit-to-viewport | 6159-6364 | 250 |
| 12 | `ColumnDragController` | column reorder DnD | 3589-3692 | 150 |
| 13 | `RowDragController` | row DnD, drop position, auto-scroll (reuse `shared/auto-scroll.ts`), `reorderData` | 5727-6159 (minus tree transforms) | 350 |
| 14 | `FormattingController` | cell class rules, style rules, color scale, data bar, icon set, cell flash | 1711-1802, 3106-3277, 3945-4046 | 300 |
| 15 | `FooterController` | footers + aggregates (`computeAggregateValue`) | 3027-3106, 5650-5664 | 100 |
| 16 | `FilterUiController` | filter inputs/outputs per column, floating filter row, filter active state, advanced builder open/state, NL box | 1062-1130, 2480-2526, 3846-3887 | 250 |
| 17 | `AiController` | NL filter, AI column fill (uses `shared/ai.ts`) | 1062-1089, 4881-4929 | 120 |
| 18 | `AriaController` | live region, sort/filter announcements, aria rowcount/colcount model (pure `computeGridAria()` consumed by render) | 2234-2275, 2806-2884 | 150 |
| 19 | `DiagnosticsController` | config warnings, dev only (dead-code eliminated via a `__DEV__`-style guard like existing ones) | 1901-2082 | 160 |
| 20 | `AddonHostController` | implements `DataTableAddonHost`, slot registries for kebab buttons, busy overlay | 5523-5650, 4186-4200, host.ts | 200 |
| 21 | `LoadingController` | loading triggers/visibility, skeleton, loader renderer | 354-396, 1175-1183, 3837-3846, 5509-5523 | 100 |

Total controller code ≈ 5.8k lines vs ~6.4k Angular; the reduction comes from deleting `computed`/input boilerplate and the
DOM-stamped ARIA pass.

Controller interaction rules:
- Controllers talk through `host.model`, `host.query`, `host.columns` and the `TopicBus`; they never import each other
  (RTE has the same rule and `rich-text-core-boundary.node.test.ts` enforces it; replicate as
  `data-table-core-boundary.node.test.ts`: no controller file imports another controller file, no core file imports an addon).
- A controller can contribute render fragments (`renderToolbar`, `renderOverlay`, `renderRowDecorations`) consumed by
  the element, as `RichTextRenderingController` does.

### 3.3 Query pipeline and memoisation

Angular recomputes lazily via signals. In Lit we replicate with explicit memo cells, defined in
`data-table-query.ts` as pure functions with an input record, so they are unit-testable in node:

```
rows        = data
afterAdv    = applyAdvancedFilter(rows, advancedFilter, columns)           // utils 748
afterGlobal = applyGlobalFilter(afterAdv, globalFilter, columns, fn)
afterCols   = applyColumnFilters(afterGlobal, columnFilters, columns)
sorted      = sortRows(afterCols, sortStates, columns)                       // multi-sort comparator
paged       = slicePage(sorted)  (or tree: filter -> sort -> flatten -> page roots)
display     = group(paged)
```

Each stage is memoised on `(previous output identity, its own inputs identity)`. Consumers must treat `data` as
immutable (replace to update), same as Angular's signal semantics; document that in-place mutation is unsupported and
add a `refresh()` method that bumps a version counter.

### 3.4 Rendering strategy

- One row template (`renderRow(display, section)`) invoked for three column sections (pinned-left / middle /
  pinned-right) instead of three copies of the markup (html is ~3x duplicated). Header, body, footer share
  `renderCellsFor(section)`.
- Grid layout with `display:flex` rows and per-column `flex` values from `ColumnsController`; sticky pinned columns with
  `position: sticky; inset-inline-start/end` so RTL is free (Angular computes `left/right` in JS, 3180-3245; we keep
  the offset maths for multiple pinned columns but emit logical properties).
- Virtual mode swaps the row list for the window + spacer rows. We reuse `VirtualAxis` from
  `virtual-scroll/virtual-axis.ts` for variable heights and do not use `ge-virtual-scroll` as a child: the data-table needs
  its own sticky header, column windowing and aria-rowindex which the generic element does not provide. The axis class
  is the shared piece; Angular's `computeVariableRowRange` / `buildPrefixSums` (utils 153-283) are replaced by it where
  equivalent, and kept only if the spec cases (190 lines) show the axis cannot express them. Decision at the end of wave 4.
- `repeat()` keyed by `getRowId` (fallback below); pinned section rows share the same key.
- Event delegation: one `pointerdown`/`click`/`dblclick`/`keydown`/`contextmenu` listener on the grid reading
  `data-row-index` / `data-col-key` (Angular has per-cell handlers; that is O(cells) listeners and a leak risk under Lit).

### 3.5 Public API

Attributes (reflect scalars, kebab-case): `show-toolbar`, `show-pagination`, `show-column-visibility-toggle`,
`show-row-borders`, `show-column-borders`, `local-sorting|pagination|filtering` (default true; `=false` for
server), `loading`, `skeleton`, `skeleton-rows`, `enable-multi-sort`, `max-multi-sort-columns`, `total`,
`enable-row-selection`, `enable-copy`, `enable-row-expansion`, `enable-sub-rows`, `sub-row-selection-mode`,
`sub-row-filter-mode`, `sub-row-indent-size`, `group-by`, `group-aggregates`, `enable-column-resize`,
`enable-column-reorder`, `show-footer` (`true|false|auto`), `enable-floating-filters`, `enable-row-drag`,
`row-drag-mode`, `enable-cell-flash`, `enable-cell-range-selection`, `enable-range-actions`, `enable-fill-handle`,
`enable-clipboard-paste`, `enable-edit-history`, `enable-nl-filter`, `enable-advanced-filter`, `filter-debounce`,
`enable-virtual-scroll` (`true|false|auto`), `virtual-row-height`, `virtual-row-buffer`, `virtual-column-buffer`,
`virtual-variable-row-height`, `page-size-options` (comma list), `show-page-size-selector`, `locale` (code string),
`theme`. Everything else is property-only.

Properties (non-attribute): `data`, `columns`, `getRowId`, `isRowDisabled`, `disabledRowIds`, `getChildren`,
`setChildren`, `globalFilterFn`, `rowDragAllowDrop`, `fullWidthRow`, renderers (`renderDetail`, `renderEmpty`,
`renderFullWidth`, `renderLoader`), `loadingVisibility`, `virtualAutoThreshold`, `aiProvider`, `localeData`
(dictionary object), and the controlled state: `rowSelection`, `expandedRows`, `subRowExpandedRows`, `collapsedGroups`,
`globalFilter`, `columnFilters`, `advancedFilter`, `sortState`, `multiSortState`, `paginationState`, `columnWidths`,
`columnVisibility`, `columnOrder`. Each controlled state emits `<name>-change` (kebab).

Events: see section 2. Plus `page-change`, `query` (debounced; for server mode, one event instead of three), `ready`.

Methods (parity with the public Angular surface): `getViewState/applyViewState`, `getColumnState/applyColumnState`,
`currentQuery`, `selectRows/unselectRows/clearSelection/selectAll`, `expandAllGroups/collapseAllGroups`,
`expandAllSubRows/collapseAllSubRows`, `scrollToRow/scrollToColumn/scrollToCell`,
`autoSizeColumn/autoSizeAllColumns/fitColumnsToViewport`, `pinColumn`, `showAllColumns`, `moveColumn`, `startEditing`,
`commitEdit/cancelEdit`, `undoEdit/redoEdit`, `copyToClipboard(scope)`, `runAiFilter`, `aiFillColumn`,
`setLoadingTrigger`, `reorderData`, `refresh`, plus `use(addon)`.

Addon contract: `DataTableAddon = { id; setup(host: DataTableAddonHost, setting): (() => void) | void }` and
`defineAddon(id, order, create)` copied in shape from `rich-text-addon-kit.ts` (context with `life: Disposables`, re-run
on `locale` topic). `DataTableAddonHost` keeps the Angular member list (host.ts) verbatim in names, but returns plain
values (no signals). Entry points:

- `@gilav21/elements/data-table` (core + define), `/data-table/define`
- `/data-table/locales/<code>` (opt-in, side-effect registration, listed in `sideEffects` as RTE does)
- `/data-table/addons/context-menu`, `/export`, `/pivot`, `/range-chart`, `/ai` (NL filter UI and AI fill UI live in the
  `ai` addon, not core, so the core has no AI strings and no filter-box code; Angular keeps them in core, which is the
  only intentional deviation, justified by size and by the RTE precedent of `addons/ai`).
- `/data-table/full` bundle pulling in all addons + locales for the lazy.

Where shared code should live:
- Generic, non-table-specific kernels go to `shared/`: `shared/formula-guard.ts` (spreadsheet.ts; the RTE table or a
  future spreadsheet could reuse), `shared/csv.ts` (parse/escape grid), `shared/xlsx.ts` if ported.
- `VirtualAxis` stays in `virtual-scroll/`; data-table imports it (no copy).
- `Disposables`, `TopicBus`, `SlotRegistry` are currently exported from `rich-text-editor/rich-text-registry.ts`. Move to
  `shared/registry.ts` and re-export from the RTE (a pure move, own PR before wave 1) so data-table does not depend on
  an unrelated component folder.
- `LocaleMeta` already lives in `shared/calendar-locales.ts`; reuse.

### 3.6 Size and structure budget (provisional)

Add `data-table/define.js`, `data-table/index.js`, each addon and `locales/*` to `size-budget.json`. Numbers get set after
wave 4 from a measurement and rounded up; targets to aim for: core define <= ~180 kB raw, <= ~45 kB gzip (the RTE
addons' define bundles are 100-260 kB raw for reference); each addon index.js <= 12 kB; each locale module <= 3 kB.

### 3.7 Styling hooks

`::part(header|header-cell|row|cell|cell-selected|cell-focused|group-row|footer|pager|toolbar|empty|overlay)`;
custom properties `--ge-dt-row-height`, `--ge-dt-header-bg`, `--ge-dt-zebra`, `--ge-dt-pin-shadow` (mapped to the
tokens in `packages/base/src/tokens.css`). Pinned-column shadow and focus ring use logical properties.

---

## 4. Details that deserve a decision up front

4.1 **Row identity.** `DEFAULT_GET_ROW_ID` (cmp 135-140) uses `row.id`, else `JSON.stringify(row)`. Collisions for
identical rows and O(size) hashing per row per pass. Lit port: same default for compatibility, but warn (Diagnostics)
whenever any feature needing stable identity (selection, edit, flash, drag, sub-rows) is on and ids are non-unique.
Optionally fall back to a `WeakMap<object, number>` identity id for object rows (stable across sort/filter, correct for
duplicates, free) and use JSON only for primitives. This is a behavioural improvement; mark it in the parity notes.

4.2 **Rendered-row-index semantics.** Angular distinguishes data index from *rendered* index (group headers excluded,
collapsed groups hidden; main spec 3087-3792). All range/focus/edit/drag controllers address cells by rendered index;
`reconcileIndexedState` (2884-2959) keeps editor on its row when rows move. Preserve exactly; put the mapping
(`renderedIndex <-> row`) in `QueryView` so nobody recomputes it.

4.3 **Editing commit path** via `runAsCommand` (4817) feeds history; fill, paste and AI fill must also go through it
or undo is incomplete (Angular does for fill/paste; check AI fill during wave 5).

4.4 **Server mode.** `query` output (single event with the whole `DataTableQuery`) is the recommended contract;
the three legacy events remain. Debounce lives in the QueryController, not the consumer.

4.5 **View state.** `applyViewState` refuses an unknown `version` outright (3770); keep. `applyColumnState` merges and
ignores empty arrays; keep (pinned by view-state spec). Persisting to storage is the consumer's job; no built-in
localStorage.

4.6 **ARIA.** Replace the post-render DOM walk (`stampGridSemantics`, 2806-2884) with a pure
`computeGridAria({ headerRows, firstDataRowOffset, totalDataRows, columnCount, windowedColumns })` used while rendering,
so there is no extra layout pass and SSR output is already correct. Same rules: spacers and filler cells
`aria-hidden`/`role=presentation` not counted, `aria-colindex` omitted when middle columns are windowed (a gap is better than a wrong
index; consider emitting absolute index = `windowStart + i + pinnedLeftCount + 1`, which is correct and removes the gap,
see risks).

---

## 5. Wave plan

Conventions: "node" = vitest node project (`*.node.test.ts`, no DOM); "browser" = `*.browser.test.ts`. Gate for every
wave: typecheck, lint, node + browser tests for the touched folder, no new `size-budget.json` violations, the
core-boundary test, SSR test (`ssr.node.test.ts` entry added once the element exists, wave 3), and Sonar-style review
(complexity limits already used in the repo). Line estimates are source / tests.

| Wave | Scope | Files | Pure (node) | Browser | Est. lines | Depends | Gate (in addition to the common gate) |
|---|---|---|---|---|---|---|---|
| **0** Prep | Move `Disposables/TopicBus/SlotRegistry` to `shared/registry.ts`; add `shared/csv.ts`, `shared/formula-guard.ts`; decide xlsx; write the `use(addon)` contract | shared/*, rich-text re-exports | all | none | 150 / 150 | none | RTE tests still green, size budget unchanged |
| **1** Pure logic | types (renderer functions instead of TemplateRef), utils (parseNlFilterSpec, ranges, prefix sums or VirtualAxis adapters, buildTreeFromFlat, buildFillValues, parseClipboardGrid, aggregates, partition/renumber, matchesCondition/evaluateAdvancedFilter, date helpers), locales (en + interface), column builder, query pipeline (data-table-query.ts), tree helpers, view-state/column-state read/apply as pure reducers, spreadsheet guard, range maths (normalise, stats, chart payload, fill source, paste coercion), `computeGridAria`, config validation as a pure `validateConfig(config): string[]`, pivot utils | `data-table.types.ts`, `.utils.ts`, `.locales.ts`, `-column-builder.ts`, `-query.ts`, `-tree.ts`, `-view-state.ts`, `-spreadsheet.ts`, `-range.ts`, `-virtual.ts`(maths only), `-aria.ts`, `-config-check.ts`, `addons/pivot/pivot-utils.ts` | all of it | none | ~2.4k / ~3.2k (port the pure parts of 465-test main spec plus advanced-filter, query, view-state, column-builder, fill, paste, ai spec pure cases, utils tests) | 0 | 100% of the pure Angular spec cases that don't need a DOM ported and green; branch coverage threshold same as RTE pure files; no `document`/`window` reference in these files (checked by the boundary test) |
| **2** Host + registry + model store | `DataTableCoreHost`, `ModelStore`/`ModelProp`, `DataTableAddonHost` interface, controller contract, factory list, addon kit (`defineAddon`), `locale` resolution, event typing | `data-table-host.ts`, `-model.ts`, `-registry.ts`, `-controllers.ts`, `-addon-kit.ts`, `-providers.ts` | host contract fakes, model store, topic bus, addon lifecycle (fake host) | one smoke | 600 / 700 | 1 | boundary test (no controller-to-controller imports), addon-kit test mirrors `rich-text-addon-kit.node.test.ts` |
| **3** Static grid shell | `ge-data-table` rendering columns/rows/header/footer/empty/skeleton/loading, pinned sections, borders, RTL, theme, ARIA from `computeGridAria`, ColumnsController, QueryController, LoadingController, FormattingController (no flash), FooterController; sub `column-header` (sort only), `pager` | `data-table.ts`, `.css`, `define.ts`, `index.ts`, `sub/column-header.ts`, `sub/pagination.ts`, controllers 1,2,14,15,21 | memo graph tests, column layout maths | render, sort click, paging, pin offsets in ltr+rtl, SSR | 1.8k / 1.6k | 2 | `ssr.node.test.ts` entry; first size-budget entry measured; a parity case (see 6.3) |
| **4** Interaction core | Selection, expansion/detail, Tree, Grouping, Virtual (rows+cols+variable), Focus/keyboard, Column resize + autofit + reorder + visibility popover, aria-live, DiagnosticsController, scrollTo*, event delegation | controllers 3,4,5,6,7,11,12,18,19 + `sub/column-header` full | tree cascade, window maths already in 1 | the large part: virtual (with real ResizeObserver), keyboard, resize drag, group/tree rendered-index (screenshot-backed specs 3087-3792) | 2.2k / 3.0k | 3 | virtual-scroll budget: 10k rows x 8 cols first render and scroll step each under budget (see 5.3); all Row Grouping rendered-index cases ported; size budgets set |
| **5** Filtering & editing UI | filter sub-elements (date, date-range, multiselect, builder, floating row), advanced filter panel, EditController + undo/redo, date editor with `ge-date-picker`, validation UI | controllers 9,16 + `sub/*filter*` | editor state machine (pure part), history stack | popovers (reuse `ge-popover`/`ge-select`/`ge-calendar`), editing keyboard flow, touch editing | 1.6k / 1.6k | 4 | focus management and Escape routes tested against the Angular edit specs 4482-4555, 6861-6993; no new global listeners left after disconnect (leak test) |
| **6** Spreadsheet & drag | RangeController, fill handle, ClipboardController, RowDragController, cell flash, touch long-press (reuse `shared/touch.ts`) | controllers 8,10,13 | range maths, TSV parse, fill series (already wave 1) | mouse/touch range, fill drag, clipboard permission paths, DnD in flat+tree | 1.2k / 1.8k | 4 (edit from 5 for paste) | clipboard tested with a fake `navigator.clipboard` and permission-denied path; pointer-leak lesson applied (park mouse in tests) |
| **7** Addons & AI | `addons/context-menu` (362), `addons/export` (116, + xlsx decision), `addons/pivot`, `addons/ai` (NL filter box, fill UI), `data-table/range-chart`, `AddonHostController` slots | `addons/*`, `range-chart/*` | pivot, export shaping, csv escape | context menu gestures (right click, long press, kebab), download via Blob stub, chart | 1.4k / 1.6k | 5,6 (host contract from 2) | each addon has its own budget line; core must not import any addon (boundary test) |
| **8** Locales, docs, polish | 9 opt-in locale modules, locale tests in the style of `rich-text-locales.browser.test.ts`, stories/docs, `full` bundle, parity cases finalisation, perf pass | `locales/*`, `full/*`, docs | locale key completeness (node: compare keys with `en`) | RTL + he/ar | 0.9k / 0.4k | 7 | each locale <= 3 kB; `component-locales.node.test.ts` extended; parity cases green |

Totals: ~10.3k source, ~13k test lines. Calendar estimate: waves 0-2 are small, 3-4 are the bulk (~55%). Waves 5 and 6
can be developed in parallel branches once wave 4 lands (they touch different controllers); merge order 5 then 6.
Consider shipping after wave 4 as `0.x` "read-only grid" (no editing/spreadsheet) behind an experimental flag.

---

## 6. Risks and open questions

### 6.1 Bundle size and locales (PR #60 lesson)
File-viewer and page-builder each grew ~8 kB gzipped by embedding ten dictionaries. Angular's `DATA_TABLE_LOCALES`
(340 lines, ~10 languages, each with ~35 keys plus the nested `advancedFilter` labels, export locales and context-menu
locales) is exactly that shape. Rules for the port:
1. Core ships `en` only (typed `DataTableLocale`), and addons ship their own `en` (RTE: `tables-locale.ts`).
2. Other languages are separate side-effect modules registering into a tiny registry (`registerDataTableLocale(code, dict)`),
   listed in `package.json#sideEffects` (the RTE entry `**/rich-text-editor/locales/*` is the template), with a per-module budget.
3. `locale` property accepts a code (looked up in the registry, else falls back to `en` and warns once in dev) or a
   full object (`localeData`). Addons look up their own table with `resolveAddonLocale` from the RTE kit (move to shared in wave 0 or copy).
4. A node test asserts every locale has exactly the `en` keys, so optional keys (`rangeSum`, `nlFilterPlaceholder`, `advancedFilter`) cannot silently drift.
5. Static check in the size gate: core `define.js` must not statically import any `locales/*` file.

### 6.2 Performance budgets (proposal; verify in wave 4)
- Pipeline for 10k rows, 8 columns, one text filter + sort: < 25 ms (node benchmark, not a hard CI gate, a soft regression test with 3x headroom).
- Virtual scroll: render of window (<= 60 rows x <= 20 cols) < 8 ms per scroll tick; no layout thrash (reads batched; ResizeObserver feedback via axis `record`).
- First paint for 100 rows x 10 cols non-virtual < 60 ms.
- Memory: no per-cell listeners; one delegated listener per event type; `repeat` keyed.
- Re-render guard: changing `loading` or `rowSelection` must not re-run filter/sort (memo identity test).
- `rowSelection` is `Record<id, boolean>` that never prunes entries for removed rows; prune on data replacement when `getRowId` is unique, otherwise it grows unboundedly in server paging.

### 6.3 Parity strategy (parity/run.mjs + parity/cases/*.mjs, 143 cases today)
Feasible, deterministic cases: (a) static grid with 3-4 columns, borders on/off, RTL; (b) sorted header with sort indicator
and multi-sort badges; (c) pinned left/right columns with sticky offsets; (d) selection column with indeterminate header;
(e) group-by with aggregates (collapsed/expanded); (f) tree with indent levels; (g) footer aggregates; (h) conditional
formatting (class rule, color scale, data bar, icon set); (i) skeleton and empty state; (j) pager (reuse pagination parity); (k) range
selection with readout; (l) virtual window at a fixed scroll offset (assert same rendered rows and spacer heights).
Not feasible or flaky: cell flash timing, drag ghost images, clipboard, ResizeObserver-driven variable heights (assert
structure, not pixels), anything popover-positioned with random content. Lesson recorded in memory: park the mouse before
hover-sensitive cases. Note: dock-narrow lesson (a shared page's width shrank others) means data-table cases need their own pages; do not pack them.
Angular behaviour changes tracked via the existing issue + `hc send t4` flow if we find Angular bugs (section 6.6).

### 6.4 Accessibility
- Keep `role=grid`/`treegrid`, `aria-multiselectable` when selection is on, `aria-sort` on headers, `aria-expanded` on expander and group rows, `aria-selected` on rows or cells (Angular: verify which; spec 244 lines is authoritative).
- Roving tabindex: one `tabindex=0` cell, Angular sets focus programmatically; keep the grid itself non-focusable when a cell is focusable.
- Live region for sort/filter/page/selection/edit-error announcements via the `AriaController`; debounce filter announcements.
- Editor focus trap: Escape returns focus to the cell (refocusTable, 4953); editors inside shadow DOM need `delegatesFocus`-safe focus calls.
- Touch: 44 px hit targets for built-in control columns (spec 5995-6033), long-press range selection must not block scrolling.
- Colour-only signals (flash, color scale, data bar) need a non-colour affordance; `iconSet` and aria text are the existing ones, add `aria-label` suffix for data bars.
- Reduced motion: cell flash and row-drag animation honour `prefers-reduced-motion` (use `shared/motion.ts`).
- RTL: arrow-key direction flips (Angular `isRtl()` 287); resize delta flips (`_isRtlResize` 290).

### 6.5 Open questions
1. **Light vs shadow for custom cells.** Shadow keeps style isolation but makes consumers' global CSS and form-associated custom cells awkward. Recommendation: shadow + `::part`; revisit if consumers need global-CSS cells (a `light-dom` mode is a large later change, not a flag).
2. **Rendering of consumer elements.** `component: 'tag-name'` instances are created per cell; for virtual lists we need recycling (`virtualRecycleComponents`, cmp 806). Plan: lit `repeat` + keyed templates already reuse DOM; implement the flag as a no-op alias with a doc note, unless benchmarks show the need.
3. **xlsx.** Port `lib/parsers/xlsx` (how large? zip store only?), or ship CSV-only plus a documented `exportProvider` hook for XLSX. Needs a look at the parser size before wave 7; if > 6 kB gzip, make it a lazily imported chunk of the export addon.
4. **Do we want `ge-table` primitives under the grid?** Recommendation: no (flex-row layout we already own is lighter than composing 6 custom elements per row); but cells should expose `part` names mirroring `ge-table-*`.
5. **Two-way `model()` semantics.** Controlled vs uncontrolled for each of ~13 states; we adopt "property wins when set, event always fires"; confirm with how `ge-select`/`ge-tabs` do it today.
6. **Sub-row `setChildren` + `reorderData`** return new trees (immutable). Keep; the element never mutates `data`. Decide whether the element ever writes `data` back (Angular `model` does: `cellEdit` with default `valueSetter`, drag-reorder with `localReorder`). Recommend: write through the `data` property and fire `data-change`, so frameworks relying on one-way flow can ignore it.
7. **Pivot** produces new columns+rows; where does the result go? (Angular directive swaps columns/data on the host.) Needs an explicit `host.setOverride({columns, data})` capability in the addon host so a reset is possible.
8. **Memory note:** Angular PR #259 follow-up hold (select-Tab `preventDefault`, bento `(pointer: coarse)`) does not affect data-table directly, but if the editor reuses `ge-select` do not mirror the Tab behaviour until t4 confirms.

### 6.6 Suspicious or Angular-only code (candidate bug reports, verify against Angular first; per memory, file an issue on shadcn-angular and `hc send t4`)
- `stampGridSemantics` (2806) omits `aria-colindex` whenever middle columns are virtualised (window < all). AT users in a wide virtual table lose column positions. Absolute index is computable (`pinnedLeft + windowStart + i + 1`, pinned-right = `colcount - k`); a bug-adjacent gap rather than an error.
- The same function walks the DOM with `querySelectorAll` after every render (afterRenderEffect on four signals): O(rendered cells) per tick during scroll; ARIA could be attribute bindings.
- `DEFAULT_GET_ROW_ID` falls back to `JSON.stringify(row)` (135-140): duplicate rows share an id (selection, edit and flash apply to all duplicates), and it throws on circular data or BigInt.
- `rowSelection`/`expandedRows` never prune stale ids (no cleanup path seen): unbounded growth in server paging; `selectedRows` (1694) only finds rows currently in `data`, so a "select all" followed by paging yields fewer rows than keys.
- `applyColumnState` (3791): a state with `width: ''` is ignored (truthiness check), so a width cannot be cleared via state; `pin: undefined` clears but `visible: undefined` doesn't (inconsistent merge semantics).
- `applyViewState` (3770) sets signals one at a time: each emits its own output, so a consumer can observe 3-5 intermediate `query` events with a half-applied state (and a server fetch per intermediate). Batch in Lit (apply all models, then emit once).
- Pagination reset to page 0 on filter is implemented as an `effect` (1802): the effect can fire after the first server `pageChange` race when restoring a view with `pageIndex > 0`; verify (`applyViewState` then filter signal change may reset the restored page). Our batched apply must set page last and suppress the reset.
- Sub-row selection cascade (5225-5338) recomputes via `findRowById` which walks the tree (5338): O(n) per toggle, O(n^2) for select-all on trees. Build a one-time id->node map in `TreeController` memo.
- Cell range selection is index-based; sorting/filtering with an active range leaves the range on different data (keepSelectionWithin only clamps); decide whether to clear on query change (recommended).
- `ColumnDef` has `_isTreeExpanderHost` (internal flag leaked into the public type) and `treeExpander` + builder `.expander()` overlap; in Lit keep `treeExpander` public and compute the host internally in `EnhancedColumnDef`.
- Dual render strategies per column (`template`, `component`, `cell`), `checkMultipleRenderStrategies` warns at runtime: collapse to a single `renderCell` in the Lit types so the invalid state is unrepresentable.
- Angular-only: `CellStyleColumn` and `EnhancedColumnDef` carry Tailwind-computed class strings built in TS (`getHeaderClass/getCellClass`, 3106-3180); in Lit use CSS classes/parts in the stylesheet and set only data attributes (`data-pinned`, `data-sticky`, `data-selected`) from code.
- Angular-only: `afterRenderEffect`, `ElementRef.nativeElement.querySelector`, `Type<unknown>` creation via `NgComponentOutlet`, `input()` transforms, `ThemeName` input, `DOCUMENT` injection, Storybook stories (do not port).

## 7. Decisions

Made with the owner on 2026-11-09, before wave 0:

1. **DOM: light DOM** (recommended by the agent; the shadow-DOM suggestion in section 6.5 is superseded). Reasons: the Angular API takes class strings for cells (`cellClassRules`, icon classes) that consumers write in their own CSS, cell content is consumer-owned markup and elements, and the grid ARIA tree (`role=grid` / `row` / `cell`, `aria-colindex`, IDREFs) is simplest in one tree. Component styles are adopted at document scope (the RTE does this) and every selector is scoped under `ge-data-table [data-slot=...]` inside a cascade layer so a consumer rule wins. Sub-elements (filters, pager, popovers) stay ordinary shadow-DOM `ge-` components.
2. **xlsx: full.** Port the xlsx export and parser, as a lazily imported chunk of the export addon if it is large.
3. **AI: as Angular.** The natural-language filter and the other AI features stay in the core, not in an addon.
4. **Cell content API.** Angular `template`/`TemplateRef` becomes renderer functions (`cellRenderer`, `headerRenderer`, `editRenderer`, `footerRenderer`, `floatingFilterRenderer`; context = row, value, column, drawn row index; result = string, Node or Lit template). Angular `component`/`Type` becomes a custom-element tag name with `componentInputs` (assigned as properties) and `componentOutputs` (event name to handler); same shape for filter, edit, footer and floating-filter components. Precedence: component, then `cellRenderer`, then the plain `cell`. Editors expose a `value` property and report changes with `change` or `value-change` (contract fixed in wave 5 from Angular's edit specs). Elements are reused across virtual-scroll recycling when the tag is unchanged.
5. **Framework components: custom elements first, adapters only on demand.** The primary route is documentation: one guide per big framework (Angular Elements, Vue `defineCustomElement`, React wrappers, Svelte and Solid custom elements) on exposing a component as a custom element and passing its tag as `component` (inputs are assigned as properties, outputs are DOM events). Wave 8 ships those guides. The core keeps the small `CellAdapter` / `CellInstance` protocol and registry (`registerCellAdapter`, newest first; a non-string `component` with no matching adapter warns once) as an optional escape hatch; framework adapters (Angular first: `createComponent` + `setInput`, outputs, `TemplateRef`; then React, Vue) are built only if there is demand, as separate entry points with peer dependencies.
6. **Accessibility beyond Angular.** Expose `aria-multiselectable`, `aria-selected` and the focused cell (roving tabindex), which Angular omits (issue #267); see section 8.

## 8. Corrections from the Angular maintainers' review (2026-11-09)

Source: D:\tmp\data-table-notes.md parts 5-8 (verified against master `99bf6c06`). Where this section and sections 1-6 disagree, this section wins. Citations in sections 1-6 are positionally accurate; the errors were about content.

**Inventory (section 1.1).** No roving tabindex in Angular (one `tabindex=0` on the scroll container plus a `focusedCell` ring); `aria-selected` and `aria-multiselectable` are never stamped (selected rows get `data-state="selected"` only); `DataTableAddonHost` has 26 members, not 33; `buildTreeFromFlat` is utils 283-312 only (314-586 is fill-series code); the 12 filter operators are utils 717-731 and types 312-325; grouping is utils 657-704; the specs hold 825 tests, not ~680.

**Suspicious spots (6.6) are superseded.** Only the default row-id fallback is a defect (`JSON.stringify` throws on circular or BigInt rows and nothing warns about duplicate ids; Angular issue #266): ship a safer default and a duplicate-id dev warning. Everything else is intended or not a bug: `aria-colindex` is omitted when columns are windowed (pinned by spec, deliberate), the DOM-walk ARIA stamping, stale ids kept in `rowSelection`, the `applyColumnState` merge rules, the query output comes from a deduplicating effect (no intermediate `query` events), the sub-row cascade uses a precomputed tree index (no O(n^2)). Port these faithfully.

**Accessibility decision (ours, beyond Angular).** Angular exposes neither the focused cell nor the selection (issue #267). Do not port the omission: the Lit grid stamps `aria-multiselectable` when selection is on, `aria-selected` on selected rows (and cells in range mode), and exposes the focused cell through roving tabindex (`tabindex=0` on one cell) with the grid itself not tabbable once a cell holds focus. `aria-colindex` stays omitted while middle columns are windowed unless an absolute index can be computed (revisit in wave 4 with the virtual-columns work). Visual parity is unaffected.

**Controller split (3.2) changes (part 7).**
- Focus, Edit and Range are ONE controller (`CellInteractionController`): the reconcile-after-render logic writes `editingCell`, `cellEditError`, `focusedCell` and `cellRange` together, and the editor-follows-row logic also runs synchronously from `commitEdit` (`keepEditorOnItsRow`).
- The cell-write pipeline (validate -> value setter -> write data -> undo entry, wrapped by `runAsCommand`) is used by Edit, Range (fill), Clipboard (paste) and AI, and needs its own channel in the host (`host.writeCell(...)` / `host.runAsCommand(...)`), not a controller.
- Grouping and Tree are stages of the Query memo graph, not peer controllers. The virtual window slices `sortedData` / `visibleTreeRows`, not the fully processed list.
- Only ~6 of the 26 addon-host members belong in an AddonHost controller; the rest are host services.
- The DOM is part of the protocol: nine methods read `data-row-index`, `data-column` and `data-row-id` back, and `getCellStringValue` reads rendered DOM. Keep those attributes and `[data-slot]` hooks stable.
- Data write-back happens in exactly three places: the value setter, `writeCellByKey` and `onRowDrop`. The element otherwise never mutates `data`.

**Wave plan and claims (part 8).**
- AI fill does NOT go through `runAsCommand`, so it is not undoable in Angular: do not promise undo for it.
- The table has no debounce layer for the query output (only `filterDebounce` on the global filter, default 0): a debounce in the QueryController would be new behaviour, not parity. Leave it out.
- There is no page-reset effect; resets live in the filter and sort handlers.
- Pivot only exposes `getPivot()`; it swaps nothing on the host, so no `host.setOverride` capability is needed.
- A usable read-only grid (wave 3) needs: `getRowId` driving the row track, the special columns (`_selection`, `_expander`, `_actions`) feeding pin offsets, `aria-colcount` and the virtual column count. Paste and fill need `focusedCell`, the value setter and `validateEdit`, so they land after the edit flow.
- Angular's tests never scroll a real element for virtual scroll and have no real-browser specs for scroll, resize, fill, paste, keyboard, drag or selection: write the real-browser versions, do not copy the specs 1:1. Ctrl/meta-click row selection does not exist (ctrl/meta are shortcuts only, shift extends a range).
- Nothing under `data-table/` changed after 2026-10-21 and no data-table issues are open: the target is stable.
