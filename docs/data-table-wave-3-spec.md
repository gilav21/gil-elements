# Data table, wave 3: the static grid shell

Spec for `ge-data-table` rendering columns, rows, header, footer and the empty, skeleton and loading states, with pinned columns, borders, RTL and grid ARIA. Companion draft stylesheet: `packages/elements/src/data-table/data-table.css`. Nothing else under `packages/` was touched to write this.

Sources: Angular `AT/data-table.component.html` ("html", 1531 lines) and `AT/data-table.component.ts` ("cmp") for the class strings built in TS (cmp 3099-3305), `AT/sub/data-table-column-header.*`, `AT/sub/data-table-pagination.*`, `ui/table/*`. Rules that win over the Angular source: `data-table-port.md` section 7 (light DOM, layered document stylesheet) and section 8 (ARIA beyond Angular).

## 0. Decisions in one screen

1. **Light DOM, one tree.** `createRenderRoot() { return this; }`. Lit renders into a wrapper the element owns, never over consumer children. Because light DOM has no `<slot>`, the element harvests its `slot="..."` children once in `connectedCallback` (`toolbar-start`, `toolbar-end`, `empty`, `loading`, `footer`), detaches them and re-inserts them as stable nodes into the matching hook container (`data-table-toolbar-end` ...). Re-rendering must never recreate them.
2. **Plain `div`s with Angular's `data-slot` names** for the grid (`table`, `table-header`, `table-row`, `table-head`, `table-body`, `table-cell`, `table-footer`), so the parity reference markup maps one to one. Not `ge-table-*`: those are shadow-DOM elements and a grid needs one ARIA tree (port doc 3.4, 7.1).
3. **One column loop, no section triplication in wave 3.** `enhancedColumns` is already ordered pinned-left, middle, pinned-right (cmp 2469-2489 via `applyColumnOrder`), so header, body and footer each loop once; DOM order is visual order, so `aria-colindex` is simply position + 1. The three-section split only appears with column windowing (wave 4).
4. **Column geometry through custom properties.** `[data-slot=table]` carries `--ge-dt-col-N`, `--ge-dt-colmin-N`, `--ge-dt-pin-N` (N = position in the ordered column list). Every head, body and footer cell of a column points at them. A resize drag (wave 4) then rewrites one property and header, body and footer follow with no re-render. Pin offsets are `calc()` sums of lengths, so `10rem` and `20%` widths work (Angular does `parseInt`, cmp 2438/2460, which reads `10rem` as 10).
5. **Pager reuses `ge-pagination` (custom mode) and `ge-select`** inside a thin `ge-data-table-pager`; section 6.2.
6. **Hooks, not classes, drive state.** Code sets `data-*` and `aria-*`; the stylesheet turns them into paint. No class strings are built in TypeScript (the Angular `getHeaderClass/getCellClass` maps, cmp 3099-3183, disappear). Consumer classes only come from `cellClassRules`.

## 1. DOM per mode

Notation: `div[table-row]` = `<div data-slot="table-row">`; `[data-table-root]` = `data-slot="data-table-root"`; other bracketed words (`data-width`, `data-pinned` ...) are plain attributes. "Wave" is where the behaviour is wired; the markup and CSS are specified now so later waves add no structure. Angular line numbers are html unless prefixed `cmp`.

### 1.1 Host `ge-data-table`

No ARIA role on the host (it is a layout wrapper). Reflected hooks, all set by the element (never by the consumer):

| Attribute | When | Used by |
|---|---|---|
| `dir` | reflects the resolved direction (Angular host `[attr.dir]`, cmp 300) | RTL rules, `:dir(rtl)` |
| `data-ui-theme` | from the `theme` property (cmp 301), via `shared/theme-presets.ts`; the preset rules there target `:host(...)`, so the light-DOM sheet needs a sibling block `ge-data-table[data-ui-theme=x] { --primary ... }` generated the same way | colour presets |
| `data-row-borders` / `data-column-borders` | `show-row-borders` / `show-column-borders` (both default true, cmp 355/357) | cell borders |
| `data-virtual` = `fixed` / `variable` | virtual scroll active (wave 4) | `contain: strict`, fixed row height |
| `data-range-selection` | `enable-cell-range-selection` (wave 6) | `user-select: none` |
| `aria-busy="true"` | `skeleton` or a visible loader | AT |

### 1.2 Normal shell (html 343-1530)

```
ge-data-table
  div[data-table-root]                                   349  flex column, gap 1rem, position:relative
    output[data-table-announcer] aria-live=polite aria-atomic=true     350  sr-only text = srAnnouncement
    div[data-table-toolbar]                              358-446  only when show-toolbar
    div[data-table-viewport] tabindex=0|-1               449  the ONE scroller
      div[data-table-loader] role=status                 463  only while a loader is visible
      div[data-table-loader] data-kind=busy role=status  494  only while an addon reports busyLabel
      div[table] role=grid|treegrid                      512  = ui-table's inner div
          aria-rowcount aria-colcount aria-multiselectable
        div[table-header] role=rowgroup                  516
          div[table-row] role=row aria-rowindex=1        517  header row
          div[table-row] data-kind=filter role=row       759  floating filter row (when enabled)
        div[table-body] role=rowgroup                    813
          ...rows...
          div[table-row] data-kind=spacer aria-hidden    1419
        div[table-footer] role=rowgroup                  1430 only when hasFooter (cmp 3067)
      span[fill-handle] aria-hidden                      1477 wave 6
      div[range-actions]                                 1490 wave 6
    ge-data-table-pager                                  1518 only when show-pagination
```

- The announcer is a live region: `<output>` as in Angular. Text is localised (new locale keys, section 8); it keeps its English fallback.
- `div[table]` carries all ARIA counts; roles come from the model in `data-table-aria.ts` (`computeGridAria`): `treegrid` iff `enable-sub-rows` (html 514), else `grid`. **Beyond Angular:** `aria-multiselectable="true"` when `enable-row-selection`.
- Cell role is `gridcell` in both roles (`columnheader` for heads). Fillers and spacers are `role="presentation"` (heads) or `aria-hidden="true"` (rows) and never counted.
- **Tab stop.** `focusedCell === null`: the viewport has `tabindex="0"` (html 461) and no cell is tabbable. Once a cell holds focus: the viewport gets `tabindex="-1"`, exactly that cell `tabindex="0"`, every other cell no `tabindex` (port doc section 8, roving). Wave 3 renders the attribute logic from a `focusedCell` input of the template function; the FocusController (wave 4) drives it.
- Keyboard and mouse handlers (html 455-459) are ONE delegated set on the viewport (port doc 3.4). Per-cell listeners (html 856-870) are not ported.

### 1.3 Header row (html 517-757)

```
div[table-row] role=row aria-rowindex=1
  div[table-head] role=columnheader aria-colindex=N   per column
      data-column-id=<key> data-width=fixed|auto data-pinned=left|right data-border
      data-special=selection|expander|actions  (special columns only)
      data-resizable (when enable-column-resize)  data-draggable data-dragging
      aria-sort=ascending|descending|none          (omitted for special and enable-sorting=false, cmp 2249-2262)
      style="--ge-dt-w:var(--ge-dt-col-N);--ge-dt-min:var(--ge-dt-colmin-N);--ge-dt-pin:var(--ge-dt-pin-N)"
    div[data-table-drop-indicator]                  537  only on the column-drag target (wave 4)
    div[data-table-head-content]                    540
      div[data-table-head-main]                     541
        <content, one of>
          ge-checkbox aria-label="Select all" checked|indeterminate     543  _selection
          div[data-table-head-controls]                                551  tree-expander host: button[data-table-icon-button][data-toggle] (expand all) + header
          button[data-table-icon-button] data-size=md  aria-label=Expand/Collapse all rows   591  _expander
          span[data-table-sr-only] "Actions"                           608  _actions
          headerRenderer output                                        610
          div[data-table-head-controls]                                617  sortable: ge-data-table-column-header + filter trigger
          div[data-table-head-controls]                                669  not sortable: <span>header</span> + filter trigger
      button[data-table-icon-button][data-table-header-action]         714  per header action slot (wave 7; opacity 0 until hover)
    div[data-table-resize-handle] role=separator    729  all columns except _selection, only with enable-column-resize
      div[data-table-resize-line] aria-hidden       742
  div[table-head] role=presentation (filler)        750  only when no column is auto width (hasFlexibleColumns false)
```

- `_selection` is NOT sortable and gets no `aria-sort`; its checkbox is a `ge-checkbox` (the `[role=checkbox]` host attribute is what the `:has([role=checkbox])` padding rule matches).
- Resize handle in wave 3: rendered only if `enable-column-resize`, with `aria-hidden="true"` and no listeners until wave 4 wires it (an inert `separator` announced to AT would lie). Wave 4 removes `aria-hidden` and adds keyboard resize (Angular has none, section 7).
- `data-column-id` on heads and `data-column` on body cells are Angular's two spellings (html 526 vs 854); keep both, the DOM read-back code uses `data-column`.

### 1.4 Floating filter row (html 758-811)

`div[table-row] data-kind=filter role=row` holding, per column, `div[table-head] role=columnheader` when the column has a floating filter (`hasFloatingFilter`, cmp 2525) and `role=presentation` otherwise (html 762), with the same width/pin style as the header cell. Content: `floatingFilterComponent` tag, `floatingFilterRenderer` output, or `ge-input` (html 790). Its filler cell is `role=presentation`. The row counts as a real row (header rows = 2 in `computeGridAria`) when rendered; wave 5 wires the inputs, wave 3 renders the row and cells empty-capable.

### 1.5 Plain data row (html 1377-1403, 1395-1399)

```
div[table-row] role=row aria-rowindex=H+i+1 aria-selected=true|false (only with enable-row-selection)
    data-kind=data data-row-index=i data-row-id=<id> data-state=selected data-disabled aria-disabled=true
    data-draggable draggable=true data-dragging          (wave 6)
  div[table-cell] role=gridcell aria-colindex=N data-column=<key> data-width data-pinned data-border
      data-special data-focused data-in-range tabindex (roving)
    <cell content>
  div[table-cell] role=presentation aria-hidden=true      1400 filler when no auto-width column
```

`H` = header rows (1 or 2). `data-row-index` is the DRAWN index (group rows not counted, port doc 4.2); every read-back method relies on it. Angular's selected state is `data-state="selected"` only; ours adds `aria-selected` (decision, section 8 of the port doc) on every data row when selection is enabled, `true` or `false`, so a screen reader hears unselected rows as selectable. Disabled rows (`isDisabled`, cmp 3317) get `data-disabled` + `aria-disabled="true"`.

### 1.6 Cell content (html 1-204)

Precedence (port doc 7.4): `component` > `cellRenderer` > `cell` > raw value; special keys first.

| Case | Markup |
|---|---|
| `component` (html 9-23) | `<tag data-slot="cell-component">`; properties from `componentInputs(row)`, listeners from `componentOutputs(row)`. No wrapper `div` (Angular's `uiComponentOutlet` div has no reason to exist). |
| `cellRenderer` | the returned template / Node / string, directly inside the cell |
| formatted (html 46-87) | `span[cell-formatted]` containing optional `span[cell-data-bar-track]`, `span[cell-data-bar]`, icon `ge-icon[cell-icon]` or `span[cell-icon]`, and `span[cell-text]` with the text |
| plain (html 88-92) | the text node |
| `_selection` (105) | `ge-checkbox aria-label="Select row"` (+ `indeterminate` in tree rows) |
| `_expander` (154) | `button[data-table-icon-button][data-size=md][data-toggle] aria-expanded aria-label` + `ge-icon` chevron-down/up |
| `_actions` (168) | one `ge-button variant=ghost size=icon` per slot, hidden when the row is disabled |
| tree host (115) | `div[data-table-tree-cell]` (indent from `--ge-dt-depth`) > toggle button or `span[data-table-tree-leaf]` + `span[data-table-text]` with the content |

`cellClassRules` classes and `cellStyleRules`/`colorScale` styles go on `span[cell-formatted]`, exactly where Angular puts them (html 50-51), NOT on the cell element; a colour scale therefore paints inside the cell padding. A custom `component` or `cellRenderer` bypasses formatting entirely in Angular (html 9-45); keep that (open question 3).

### 1.7 Tree rows (html 1158-1247), treegrid

Same as 1.5 plus on the row: `data-depth`, `style="--ge-dt-depth:d"`, `aria-level=d+1`, `aria-expanded=true|false` (omitted on leaves, html 1178). Cells have no `bg-background`; the stylesheet shades them from `--ge-dt-depth` (`color-mix(in srgb, var(--border) min(depth*20,80)%, var(--background))`, cmp 3201-3218). Indent: `--ge-dt-indent` (= `sub-row-indent-size`, default 20) written on the host.

### 1.8 Group header row and group data rows (html 1248-1341)

```
div[table-row] data-kind=group role=row data-group-key aria-expanded=!collapsed
  div[table-cell] role=gridcell data-width=full
    div[data-table-group-label]
      button[data-table-icon-button][data-toggle] aria-expanded aria-label=Expand/Collapse group
      span[data-table-text] label   span[data-table-group-meta] "(count)"   span[data-table-group-meta] "label: value" per aggregate
```
Group data rows are ordinary data rows (1.5). Group header rows are not counted by `data-row-index`, but are real rows for `aria-rowindex` (Angular counts them, they are not decorative). The group row is keyboard-reachable only through its button (Angular binds Enter/Space on a non-focusable row, html 1261: dead). Whether grouping should force `treegrid` is open question 4.

### 1.9 Detail row (html 1134-1148, 1229-1243, 1404-1410)

`div[table-row] data-kind=detail role=row` > `div[table-cell] role=gridcell data-width=full` > detail content (`renderDetail`, or `pre[data-table-detail-json]` with the JSON, html 306). It follows its data row; it is counted by `aria-rowindex` like Angular. The expander button carries `aria-expanded` and `aria-controls=<detail row id>` (beyond Angular; the detail row gets `id="ge-dt-<uid>-detail-<rowId>"`).

### 1.10 Full-width row (html 1348-1375)

`div[table-row] data-kind=full-width ... data-row-index data-row-id` > one `div[table-cell] data-width=full` with the renderer output.

### 1.11 Empty state (html 313-333)

`div[table-row] data-kind=empty role=row` > `div[table-cell] data-kind=empty role=gridcell aria-colspan=<colcount> data-width=full` > `div[data-table-empty-content]` > `ge-icon name=circle-off size=xl` + `<p>` text (`noResultsLabel`), or the `empty` slot / `renderEmpty` output. Rendered when the visible row list is empty (html 1151, 1246, 1340, 1414). Not `aria-live`; the announcer reports "no results" on filter changes (Angular does not).

### 1.12 Skeleton (html 335-342)

```
div[data-table-skeleton]            (replaces the whole shell, toolbar and pager included, as in Angular)
  ge-skeleton data-kind=bar         h-9
  ge-skeleton data-kind=row  x N    h-12, N = skeleton-rows (default 5)
  ge-skeleton data-kind=bar         h-9
```
Host gets `aria-busy="true"` and the container a `role="status"` with an sr-only `loadingLabel`. The skeleton children are decorative (`aria-hidden`).

### 1.13 Loading overlay (html 463-507)

`div[data-table-loader] role=status` > custom `loading` slot / `renderLoader`, else `div[data-table-loader-box]` > `span[data-table-spinner]` + `<span>Loading...</span>` (text localised). Visible when `loading && shouldShowLoaderFor(trigger)` (cmp 1205). It is `position:absolute; inset:0` inside the scroller, so it scrolls with the content (as in Angular); keep.

### 1.14 Footer (html 1429-1474)

`div[table-footer] role=rowgroup` (Angular: a bare div) > `div[table-row] role=row` > `div[table-cell] role=gridcell` per column, with `footerRenderer` / `footerComponent` output or the `footerValues` text; plus an `aria-hidden` filler cell when no column is auto. The footer row takes the next `aria-rowindex` after the last data row; it is not part of `aria-rowcount` in virtual mode in Angular (UNVERIFIED for the non-virtual stamp); we count it in both (open question 5).

### 1.15 Spacer and filler (html 1419-1427, 750, 1222)

Spacer: `div[table-row] data-kind=spacer aria-hidden="true"` with a bare cell per column (`padding:0`, no border). Fillers: `role=presentation aria-hidden=true`, no `aria-colindex`. See section 7: Angular's BODY filler is a counted `gridcell`, which makes rows one cell wider than `aria-colcount`.

### 1.16 Toolbar (html 358-446)

```
div[data-table-toolbar]
  div[data-table-toolbar-start]
    ge-input[data-table-filter] aria-label=<filterPlaceholder>      361  global filter, debounced by filter-debounce
    div[table-nl-filter]  ge-input ...                              368  only with an aiProvider (wave 7)
    <advanced filter>: ge-popover > button[advanced-filter-trigger] 380  wave 5
  slot toolbar-start / toolbar-end containers
  ge-popover > button[data-table-columns-trigger] aria-label        415  when show-column-visibility-toggle and hideable columns exist
    popover content: div[data-table-columns-item] > ge-checkbox + span per column
```
The columns popover is wave 3 (it only edits `columnVisibility`); the advanced filter and NL box are markup-reserved, wired later. The input needs an accessible name: Angular only sets `placeholder`; we add `aria-label` from the same string.

### 1.17 Pager (html 1517-1528)

`ge-data-table-pager` (section 6.2) with `total=activeTotalItems`, `.state=paginationState`, `.pageSizeOptions`, `.showPageSizeSelector`, the three labels. Listens to its `pagination-change` and re-emits `page-change` on the table (port doc section 2).

### 1.18 ARIA summary

| Where | Attribute | Value | Source |
|---|---|---|---|
| `div[table]` | `role` | `grid`, `treegrid` with sub-rows | html 514 |
| | `aria-rowcount` | header rows + dataset rows (whole dataset under virtual scroll) | cmp 2859 |
| | `aria-colcount` | all ordered columns incl. `_selection/_expander/_actions` | cmp 2860 |
| | `aria-multiselectable` | `true` with row selection | decision |
| row | `aria-rowindex` | `computeGridAria().headerRowIndex / dataRowIndex` | cmp 2847 |
| | `aria-selected` | data rows when selection is on | decision |
| | `aria-level`, `aria-expanded` | tree rows (leaf: no `aria-expanded`); group rows `aria-expanded` | html 836, 1259 |
| cell | `aria-colindex` | position + 1; omitted when middle columns are windowed (wave 4) | cmp 2849 |
| | `tabindex` | roving, 1.2 | decision |
| head | `aria-sort` | `ascending/descending/none` | cmp 2249 |
| decorative | `aria-hidden` / `role=presentation` | spacer, fillers, skeleton bars, resize line | html 752, 1419 |
| announcer | `aria-live=polite aria-atomic=true` | sort/filter text | html 350 |

## 2. Tailwind to CSS

### 2.1 Layer and scope

All rules live in `@layer ge-data-table { ... }` in `data-table.css`, adopted once per document with `adoptSheet(document, 'ge-data-table', css)` (same helper as `rich-text-content.ts`, refcounted so the last disconnect removes it). Every selector starts with `ge-data-table` (host rules) or `ge-data-table [data-slot="..."]`. An unlayered consumer rule always beats a layered one; a consumer layer declared after `ge-data-table` also wins (declare `@layer ge-data-table;` early if they need to order it). The SSR path (`ssr.node.test.ts`) must not touch `CSSStyleSheet`; the adopt call lives in `connectedCallback`. `box-sizing: border-box` is set inside the layer for the host and descendants (Tailwind's preflight does that for Angular; the shadow roots get it from `base.css`).

### 2.2 Class string to rule (Angular element -> `data-slot`)

Colours: `bg-background`=`var(--background)`, `border` / `border-input`=`var(--border)` / `var(--input)`, `/NN` alpha = `color-mix(in oklab, var(--x) NN%, transparent)`. `rounded-md` = `calc(var(--radius) - 2px)`, `rounded-sm` = `calc(var(--radius) - 4px)`. Density: `--_d: var(--density-data-table, var(--density-table, var(--density, 1)))` (Angular's cell and head sheets read `--density-table`, so that stays the fallback).

| Angular (line) | Classes | Rule target |
|---|---|---|
| root 349 | `relative flex flex-col w-full h-full space-y-4` | `[data-table-root]`: relative, flex column, `gap: 1rem` (equal to space-y-4: the only absolute child is the sr-only announcer) |
| 359 | `flex flex-wrap items-center justify-between gap-2 flex-none` | `[data-table-toolbar]` |
| 360 | `flex flex-1 flex-wrap items-center gap-2` | `[data-table-toolbar-start]` |
| 365 | `h-8 w-full sm:w-[150px] lg:w-[250px]` | `[data-table-filter]`, `@media (min-width: 40rem / 64rem)` |
| 376 | `h-8 w-full sm:w-[200px]` | `[table-nl-filter] > ge-input` |
| 386 | `inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-3 h-8 pointer-coarse:h-11 pointer-coarse:min-w-11 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground` | `[advanced-filter-trigger]` (+ coarse + hover media) |
| 389 / 391 | `hidden sm:inline` / `inline-flex h-5 min-w-5 ... rounded-full bg-primary px-1 text-xs text-primary-foreground` | `[data-hide-below=sm]`, `[data-table-count-badge]` |
| 420 | same as 386 with `gap-2 justify-center`, no coarse rule | `[data-table-columns-trigger]` |
| 430 | `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent ...` | `[data-table-columns-item]` |
| 451 | `rounded-md border relative flex-1 min-h-0 overflow-auto w-full` (+`contain-strict will-change-scroll` virtual, `select-none` range) | `[data-table-viewport]`, `[data-virtual]`, `[data-range-selection]` |
| 465 | `absolute inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-[1px]` | `[data-table-loader]` |
| 484 | `flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground` | `[data-table-loader-box]` |
| 487 | `inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground` | `[data-table-spinner]` + `@keyframes ge-dt-spin` |
| ui-table | `flex flex-col w-full min-h-0 overflow-x-auto` + `overflow-visible` (html 513) | `[table]` (`overflow: visible`) |
| ui-table-header | `sticky top-0 z-20 bg-background flex-shrink-0` | `[table-header]` |
| ui-table-body | `flex flex-col flex-1` | `[table-body]` |
| ui-table-row | `flex w-full min-w-max flex-shrink-0 hover:bg-muted/50 data-[state=selected]:bg-muted transition-colors` | `[table-row]`, hover in `@media (hover: hover)`, `[data-state=selected]` |
| row 1004 etc | `border-0`, `opacity-50` (disabled), `opacity-30 ring-2 ring-primary/30 ring-inset bg-primary/5` (dragged), `relative` (drag modes) | `border-width:0`, `[data-disabled]`, `[data-dragging]`, `[data-draggable]` |
| ui-table-head | `flex items-center flex-shrink-0 text-foreground ltr:text-left rtl:text-right font-medium flex-1`, height `2.5rem*d`, padding-inline `0.5rem*d` | `[table-head]`, `text-align: start` |
| head 3123 | `sticky top-0 bg-background shadow-sm whitespace-nowrap overflow-hidden text-ellipsis pointer-coarse:h-auto z-20/z-30 border-r relative` | `[table-head]`; `[data-pinned]` z-index 30; `border-r` -> `border-inline-end` on `[data-border]` |
| ui-table-cell | `flex items-center flex-shrink-0 flex-1`, padding `0.5rem*d` | `[table-cell]` |
| cell 3101 | `whitespace-nowrap overflow-hidden text-ellipsis bg-background border-b border-r` | `[data-width=fixed|auto]` cells; borders from `data-row-borders` / `data-column-borders` + `data-border` |
| cell state 3173-3180 | `bg-background ring-2 ring-primary ring-inset relative z-10` / `bg-primary/15` / `bg-primary/5 outline-1 outline-dashed outline-primary/40 -outline-offset-1` | `[data-focused]`, `[data-in-range]`, `[data-fill-preview]` |
| checkbox cells | `[&:has([role=checkbox])]:ltr:pr-0 rtl:pl-0`, `[&>[role=checkbox]]:translate-y-[2px]` | `:has([role=checkbox])` `padding-inline-end: 0`; `> [role=checkbox] { translate: 0 2px }` |
| floating filter 764 | `sticky top-[var(--header-height,41px)] z-20 bg-muted/50 py-1 px-1 overflow-hidden pointer-coarse:h-auto` | `[table-row][data-kind=filter] > [table-head]` (no offset, section 7) |
| 716 | `opacity-0 group-hover/head:opacity-100 touch-visible ... transition-opacity` | `[data-table-header-action]` |
| 123/157/554/637/1271 | `inline-flex h-6 w-6 (h-7 w-7 / h-8 w-8) shrink-0 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground pointer-coarse:size-11` | `[data-table-icon-button]` with `data-size=md|lg` |
| 132-134 | `transition-transform duration-200 rotate-90 / -rotate-90` | `[data-toggle][aria-expanded=true] > ge-icon` (`:dir(rtl)` flips the angle; render chevron-right always and let CSS rotate, one icon name) |
| 731 | `absolute top-0 w-4 h-full cursor-col-resize touch-none z-40 select-none right-0 translate-x-1/2 | left-0 -translate-x-1/2` | `[data-table-resize-handle]`: `inset-inline-end:0; translate: 50% 0`, `:dir(rtl)` -50% |
| 3228 | `absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent group-hover/resize:bg-primary/50 | bg-primary/70` | `[data-table-resize-line]`, `[data-resizing]` |
| 537 | `pointer-events-none absolute inset-0 z-30 border-2 border-primary/70 bg-primary/10` | `[data-table-drop-indicator]` |
| 50-77 | `relative flex w-full items-center gap-1.5`; bar `pointer-events-none absolute inset-y-0.5 start-0 rounded-sm` (+ track `inset-x-0`); icon `relative shrink-0`; text `relative min-w-0 truncate` | `[cell-formatted]`, `[cell-data-bar(-track)]`, `[cell-icon]`, `[cell-text]` |
| 117 | `flex items-center gap-1 min-w-0` + padding-inline-start `depth * indent` | `[data-table-tree-cell]` |
| 314-327 | row `hover:bg-transparent justify-center w-full`; cell `h-48 sm:h-96 text-center w-full p-0 border-none justify-center`; content `flex h-full flex-col items-center justify-center py-10 text-center text-muted-foreground w-full`; icon `mb-4 opacity-20` | `[data-kind=empty]` row/cell, `[data-table-empty-content]` |
| 1135 | `border-0 bg-muted/20`; cell `flex-1 border-b` + inline `min-width:0;max-width:none;width:100%;flex-basis:100%` | `[data-kind=detail]`, `[data-width=full]` |
| 1256 | `border-0 bg-muted/40 cursor-pointer select-none`; cell `flex-1 border-b font-medium`; label `flex flex-wrap items-center gap-2`; meta `text-xs text-muted-foreground` | `[data-kind=group]`, `[data-table-group-label]`, `[data-table-group-meta]` |
| 1431 | `sticky bottom-0 z-20 bg-background border-t`; cells `whitespace-nowrap overflow-hidden text-ellipsis text-sm font-medium text-muted-foreground` | `[table-footer]` |
| 336-341 | `flex flex-col w-full space-y-3`; `h-9 w-full rounded-md`; `h-12 ...` | `[data-table-skeleton]`, `ge-skeleton[data-kind]` |
| 1008/1011/1014 | drop edges `absolute inset-x-0 top-0 z-30 h-0.5 bg-primary shadow-[0_0_4px_0] shadow-primary` / border-2 variants | `[data-table-drop-edge][data-edge]` |
| 1480/1493 | fill handle and range-actions bar | `[fill-handle]`, `[range-actions]` (wave 6, in the sheet already) |

### 2.3 Variant dependencies and how each becomes CSS

| Tailwind variant | Where | CSS here |
|---|---|---|
| `hover:` | rows, buttons, triggers, resize line | `@media (hover: hover) { :hover }` (Tailwind 4 emits the same media wrap) |
| `pointer-coarse:` | 44px targets, `h-auto` heads, `h-11` triggers | `@media (pointer: coarse)` |
| `sm:` / `lg:` | filter width (365), advanced label (389), empty height (316), pager | `@media (min-width: 40rem)` / `(min-width: 64rem)`. Viewport based, as in Angular; a container query would be better but breaks parity |
| `group-hover/head:` `group-hover/resize:` | header action, resize line | `[table-head]:hover [action]`, `[handle]:hover > [line]`, both in the hover media; plus `:focus-within` / `:focus-visible` (Angular hides a focused button, section 7) |
| `touch-visible` (custom, `@media (hover: none)`) | header action | `@media (hover: none) { opacity: 1 }` |
| `ltr:` `rtl:` | head text align, checkbox padding (table primitives) | logical properties (`text-align: start`, `padding-inline-end: 0`) |
| `right-0` / `left-0` / `border-r` / `-translate-x-1/2` | resize handle, column borders (physical in Angular) | `inset-inline-end`, `border-inline-end`, and `:dir(rtl)` only on the handle's translate |
| `data-[state=selected]:` | row | `[data-state="selected"]` |
| `dark:` | none in the data table or its sub parts (grep: zero) | tokens only |
| `supports-*`, `motion-*` | none | `prefers-reduced-motion: reduce` block added (Angular has none) |
| arbitrary `top-[var(--header-height,41px)]` | floating filter | dropped, section 7 |

## 3. Styling hooks for consumers

Custom properties (documented, stable): `--ge-dt-row-height` (virtual fixed rows; default 40px, 60px coarse), `--ge-dt-header-bg`, `--ge-dt-cell-bg`, `--ge-dt-pin-shadow` (default `none`; Angular draws none, a consumer may set `inset -1px 0 0 var(--border)` or a gradient), `--ge-dt-indent`, `--ge-dt-expander-w`, plus the global `--density`, `--density-table`, `--density-data-table`. Selectors a consumer may rely on: every `data-slot` in section 1, `[data-column="key"]` for one column, `[data-row-id]`, `[data-state=selected]`, `[data-pinned]`, `[data-kind]`. Classes from `cellClassRules` land on `[data-slot=cell-formatted]`.

Set by render code inline, never by CSS:

| Property | Element | Value |
|---|---|---|
| `--ge-dt-col-N`, `--ge-dt-colmin-N`, `--ge-dt-pin-N` | `div[table]` | resolved width (`columnWidths` > `width` > pinned `150px` > auto), floor (`minWidth` or `80px`, special columns `0px`, notes part 1 entry 14), pin sums |
| `--ge-dt-w`, `--ge-dt-min`, `--ge-dt-pin` | each head/cell/footer cell | `var(--ge-dt-col-N)` etc. |
| `--ge-dt-depth` | tree rows | depth |
| `--ge-dt-indent` | host | `sub-row-indent-size` px |
| `--ge-dt-row-height` | host | only when `virtual-row-height` is set |
| `style` | `cell-formatted` | `cellStyleRules` result, color-scale background; `cell-data-bar` gets `width` and `background-color`, the track `background-color` |
| `style` | `div[table-row]` | none in wave 3 (Angular's inline `height` px for virtual rows becomes the CSS rule on `[data-virtual=fixed]`) |

Set by CSS only: paddings, heights, borders, z-indexes, sticky offsets for header/footer, hover, selected, disabled, focus ring, range tint, drag feedback, all transitions, the spinner.

Pinned semantics: `pin: 'left'` means inline-start and `'right'` inline-end (logical), so a pinned-left column stays first in RTL. Angular offsets are physical (cmp 3220-3229) and mis-stack in RTL (section 7).

## 4. RTL, dark mode, density, motion, touch

- **RTL.** The host reflects `dir`. Everything is logical (`padding-inline-*`, `inset-inline-*`, `border-inline-end`, `text-align: start`), so only two rules need `:dir(rtl)`: the resize handle translate and the chevron rotation. Icons that point (chevrons in the pager, tree toggle) are mirrored by choosing the glyph or rotating, as in Angular (html 130, pager html). Sort arrows are vertical, not mirrored. Arrow-key navigation direction (wave 4) reads the same `dir`. Parity RTL case uses `show-column-borders` off because Angular's `border-r` stays physical.
- **Dark.** No literal colour in the sheet; `.dark` / `[data-theme=dark]` retokenise `--background`, `--border`, `--muted`. `color-mix` formulas (tree shading, overlays) follow. Nothing needs a `dark:` rule. Both themes are rendered by `run.mjs` for every case.
- **Density.** `--_d` on the host scales cell padding (`0.5rem*d`) and head height (`2.5rem*d`). Other heights stay as in Angular (h-8 triggers, h-6/7/8 icon buttons, fixed virtual row height) because the Angular table primitives scale only those two; a `density-1.5` parity case mirrors `table.mjs`.
- **Reduced motion.** The spinner, row/background transitions, the chevron rotation and the header-action fade are switched off under `prefers-reduced-motion: reduce`. Skeleton pulse is already handled inside `ge-skeleton`. The wave-6 cell flash must honour it too (`shared/motion.ts`). `--motion` is not used by other CSS in the repo, so it is not read here.
- **Touch (`pointer: coarse`).** Built-in icon buttons (expander, tree toggle, group toggle, filter trigger, header action) and the advanced-filter trigger become 2.75rem (44px) square; header cells become `height:auto`; the expander column is 64px (`--ge-dt-expander-w`); virtual fixed row height is 60px. These match `DT.browser:381/405` and html 123, 157, 386, 554, 637, 716, 1271. `ge-checkbox` and `ge-button` size their own touch targets; verify in the browser test that the select column checkbox hit area is 44px. Angular reads `coarsePointer` from JS (cmp 1901); we let CSS own the numbers and read the row height once from `getComputedStyle(viewport).getPropertyValue('--ge-dt-row-height')`, so the two cannot drift.

## 5. Parity plan

`parity/` compiles Angular class strings with Tailwind (reference side) and the `ge-` markup (element side) and compares pixels in light and dark. Every data-table case file sets `isolated: true` and its own `width` (the dock-narrow lesson: a shared page takes the first case's width, and the `sm:` / `lg:` rules react to the viewport). Page height is not an issue because cases stay small (<= 6 rows).

Reference markup strategy: copy Angular's RENDERED markup (class strings per section 2.2, `data-slot`, `role`, inline `style` from `_buildCellStyle`) into helper functions in `parity/cases/data-table.mjs`, like `table.mjs` does with `rHead/rCell/rRow`, reusing the table primitive strings. `ui-checkbox`, `ui-icon`, `ui-button`, `ui-skeleton`, `ui-select` and pagination reference markup should be imported from `checkbox.mjs`, `pagination.mjs` etc., which means exporting their builders (a two-line change per file, done in wave 3, not here). One-off check that the helpers did not drift: a manual dump of the Angular fixture's `outerHTML` (the Angular browser spec renders the same component) diffed against the helper output; not automated. The Angular side is pinned in `parity/README.md`.

| File (all `isolated: true`) | Width | Items |
|---|---|---|
| `data-table.mjs` | 700 | basic 4 col x 4 rows; borders row only / column only / none; `density-1.5`; selected row (`data-state`); zebra-less disabled row; footer with aggregates; sorted header (asc, desc, multi-sort badge 2); no toolbar; no pagination |
| `data-table-pinned.mjs` | 460 (forces horizontal scroll; scrollLeft 0 and a second item scrolled by 120px via the case `setup` hook if the runner has one, else a wide inner content) | pin-left x1, left x2, right x1, both; with and without column borders; sticky header over scrolled body |
| `data-table-rtl.mjs` | 700 | `dir=rtl` basic, pinned-left (checks logical stacking, Angular has the bug so this case compares only with the physical-Angular-equivalent markup: reference uses `right` offsets; document the expected 0-pixel difference or mark `skip`), row borders only |
| `data-table-states.mjs` | 700 | empty (default), empty custom slot, skeleton (N=3), loading overlay over rows, busy overlay |
| `data-table-tree.mjs` | 700 | depth 0-3 with shading, expanded / collapsed chevrons, leaf spacer |
| `data-table-group.mjs` | 700 | collapsed and expanded group header with count and aggregates, group data rows |
| `data-table-detail.mjs` | 700 | detail row under a data row with JSON `pre` |
| `data-table-format.mjs` | 700 | class rule, style rule, color scale, data bar with track, icon (glyph, named) |
| `data-table-toolbar.mjs` | 700 and a `data-table-toolbar-narrow.mjs` at 500, plus `data-table-toolbar-wide.mjs` at 1100 | filter input width steps (150/250), columns trigger, advanced trigger with count badge, label hidden below `sm` |
| `data-table-pager.mjs` | 700 / narrow 500 / wide 1100 | page 1 of 5, middle page, last page, no page-size selector, `rtl` |
| `data-table-touch.mjs` | 700 with `pointer: coarse` emulation if the runner can (it renders `@media` per context; otherwise unit-test only) | 44px buttons, `height:auto` head, 64px expander |

Infeasible or excluded: cell flash (timing), drag ghost and drop edges (state is transient; assert structure in a browser test instead), range/fill/range-actions (wave 6), resize drag, virtual scroll (structure test only, spacer heights), anything with a popover open, `ge-input` height in the floating filter row until `ge-input`'s host-height behaviour is confirmed, RTL + column borders (Angular physical vs our logical, intentional difference), the `empty` icon if `circle-off` differs between icon sets (compare after the `icon` case is green). Pixel differences from fonts in checkbox hosts follow the existing checkbox case.

Non-parity tests wave 3 also needs: node tests for `computeColumnLayout` (widths, floors, pin sums, specials), `computeGridAria` wired to markup (done), the SSR entry (`ssr.node.test.ts`: renders no `CSSStyleSheet` use at import), browser tests for pinned stacking in ltr and rtl, sort click, paging, the focus tab-stop switch, and `data-row-index` / `data-column` / `data-row-id` read-back.

## 6. Sub-parts of wave 3

### 6.1 `ge-data-table-column-header` (shadow DOM)

Port of `sub/data-table-column-header.component.{ts,html}`. It owns only the sort button; the filter trigger, resize handle, kebab and drag handle live in the head cell (light DOM, section 1.3), not in this element. Wave 4 adds nothing to it except `aria-describedby` hooks.

Markup (shadow): `div[part=base] data-slot="data-table-column-header"` flex, `gap-x-2`:
- not sortable: `<div>{title}</div>`;
- sortable: `ge-button variant=ghost size=sm` (host rule: `margin-inline-start: -0.5rem; height: 2rem; min-width: 0; flex-shrink: 1`; `pointer: coarse`: `height: 2.75rem; min-width: 2.75rem`), `aria-label` = label, containing `span.truncate {title}`, `ge-icon` (`arrow-up` asc, `arrow-down` desc, `chevrons-up-down` none; `margin-inline-start: .5rem`, 1rem square) and, when `sortIndex != null`, `span[aria-hidden=true]` badge `index + 1` (`margin-inline-start: .25rem; inline-flex; 1rem min-size; rounded-full; bg --muted; padding-inline .25rem; font-size 10px; line-height 1`).

| Property / attribute | Type | Default | Notes |
|---|---|---|---|
| `title` | string | `''` | text and label prefix |
| `column` | string | `''` | informational (Angular: same) |
| `direction` | `'asc' \| 'desc' \| null` | `null` | controlled; never changed by a click |
| `enable-sorting` | boolean | `true` | false: text only, no event |
| `sortIndex` | number \| null | `null` | zero-based; shows `index + 1` badge, multi-sort only |
| `label` | string | derived | accessible name of the button. The table passes a localised string from a pure `sortAriaLabel(title, direction, index, locale)`; if absent the element builds Angular's English sentence ("{title}, sorted ascending, sort priority 2. Activate to sort descending."). |

Event: `sort-request`, `detail: { direction: 'asc' | 'desc' | null; multi: boolean }`, `bubbles: true, composed: false` (it is dispatched on the host, which sits in the table's light DOM; the table handles it and calls `stopPropagation()` so it does not leak). This replaces Angular's `sort` + `sortMeta` pair (the first is the second without `multi`; nobody needs both). Cycle: none -> asc -> desc -> none. Activation is the native `click` only; no Enter/Space handlers on top (notes part 1 entry 1: double activation, issue #165). `multi` = `event.shiftKey` of the click. `aria-sort` is NOT set here; the head cell owns it. Resize handle: the "placeholder" for wave 3 is the inert, `aria-hidden` `div[data-table-resize-handle]` in the head cell, not part of this element.

### 6.2 `ge-data-table-pager` (reuse `ge-pagination`)

Decision: reuse. Angular's pager (`sub/data-table-pagination.component.html`) is not a page-number list: it is "Rows per page" select + "Page X of Y" + four chevron links (first and last hidden below `lg`). It already composes `ui-pagination-link` in custom mode with a border/shadow class, so the Lit pager composes `ge-pagination` (custom mode: `ge-pagination-content` > `ge-pagination-item` > `ge-pagination-link size=icon`) and `ge-select`. It does not use `ge-pagination`'s quick form (numbered pages) and does not reimplement paging maths: the only logic is Angular's six clamps (`totalPages = max(1, ceil(total / (pageSize > 0 ? pageSize : 10)))`, first, last, next, previous, size change resets to page 0), kept as a pure `pagerNext(state, total)` helper beside `data-table-query.ts` so node tests cover it.

Markup (shadow): `div[data-slot=data-table-pagination]` flex wrap, `justify-content: space-between`, `padding-inline: .5rem`, `row-gap: .5rem`; empty `flex-1` left cell (Angular has an empty `text-sm` div, html line 2; used for balance); right group `flex; align-items:center; gap` `.5rem` / `1.5rem` at `sm` / `2rem` at `lg`; the select group (label `hidden` below `sm`, `ge-select` `h-8 w-[70px]`, popup `side=top`); the link row. Link borders and shadow (`border border-input rounded-md bg-background shadow-sm`) are applied through `ge-pagination-link::part(base)` in the pager's own stylesheet because the link host is `display: contents`. Labels (`Go to first page`, ... `Go to last page`) are sr-only text from new locale keys. Chevron glyphs mirror in RTL (read from `isRtl(this)` in `shared/menu.ts`).

| Property | Type | Default |
|---|---|---|
| `total` | number | `0` |
| `state` (property only) | `{ pageIndex, pageSize }` | required |
| `pageSizeOptions` | number[] | `[10, 20, 30, 40, 50]` (attribute: comma list) |
| `show-page-size-selector` | boolean | `true` |
| `rowsPerPageLabel`, `pageLabel`, `ofLabel` | string | locale |
| first/previous/next/last labels | string | locale |

Event: `pagination-change`, `detail: PaginationState` (clamped; size change resets `pageIndex` to 0), `bubbles: false`. The table listens and emits `page-change` / updates the `paginationState` model. A page size that is not in `pageSizeOptions` still shows (as the select placeholder). The pager hides nothing by itself when `total` is 0: one page, both directions disabled.

## 7. Things in the Angular template that look wrong or Angular-specific

Candidates for the Angular issue + `hc send t4` flow once verified there. Wave 3 does NOT copy the first group; the second group is mechanism.

**Looks wrong**
1. Row hover and selected backgrounds are invisible: every cell paints `bg-background` (cmp 3101) over the row's `hover:bg-muted/50` / `data-[state=selected]:bg-muted`; only the checkbox shows selection. Port keeps parity (cell bg `var(--ge-dt-cell-bg)`), a consumer can tint through that property. Open question 1.
2. Floating-filter `top-[var(--header-height,41px)]` (html 764, 807): `--header-height` is never defined anywhere, and the inline style from `getHeaderCellStyle` sets `top: 0` on every header-type cell (cmp 3230-3234), which beats the class. Dead; dropped.
3. Body filler cell is a counted `gridcell` (html 1222-1226, 1400-1402, no `role=presentation`), while the header filler is `presentation` (html 752). With all-fixed widths each row has `aria-colcount + 1` cells and the stamp gives it `aria-colindex = colcount + 1`. Ours marks body fillers decorative.
4. Pin offsets use `parseInt` of the width (cmp 2438, 2460): `10rem` and `20%` stack as 10px / 20px. Pin sides are physical (cmp 3220-3229), so in RTL `pin: 'left'` stacks from the wrong edge of a right-origin grid. `border-r` for column borders (cmp 3104) is physical too.
5. Group header row: `aria-expanded` on a `role=row` in a plain `grid` is not a supported state (only `treegrid`); Enter/Space handlers sit on the row (html 1261-1262), which is not focusable, so only the inner button works by keyboard.
6. Footer: a bare `div` (html 1430), not a `rowgroup`; pinned footer cells have no background, so scrolled cells show through them.
7. Header action button is `opacity-0` until hover (html 716) but stays focusable, so a keyboard user focuses an invisible button. `touch-visible` fixes touch only.
8. Resize handle: `role="separator"` without `aria-orientation` / value, not focusable, no keyboard path; the label is a 70-character sentence (html 740).
9. Hard-coded English in templates: `Select row` (113), `Select all` (547), `Actions` (608), `Expand/Collapse row|sub-rows|group|all rows` (124, 158, 555, 594, 1272), `Filter {header}` (641, 679), `Column menu for` (717), `Resize ... column` (740), `Loading...` (489), `Go to first page` etc. and the sort aria-label (column-header.ts). Ours takes all of them from the locale (new keys, section 8).
10. The two column-filter popovers differ: `closeOnScroll` on the sortable branch (634) but not the plain one (672); both filter buttons lack `type="button"` (637, 675).
11. Spacer row `h-full` (html 1419): a percentage height inside an auto-height flex column resolves to content, i.e. 0. It is `aria-hidden` and probably does nothing. Kept in the markup (parity) behind `data-kind=spacer`; verify in the browser before deciding to drop it.
12. Cell `keydown.enter` / `keydown.space` handlers on `ui-table-cell` (html 859-864 and the other 6 copies) bubble from an inner button, so Enter on the tree toggle runs both the button and the cell handler (the same double-activation family as entry 1 of the notes).
13. The group data row has no cell click / key / touch handlers (html 1310-1315) unlike flat and tree rows: whether click-to-focus works in grouped mode rests on the container's mousedown hit test (UNVERIFIED).
14. The emoji glyph `✨` as an icon (html 369) is `aria-hidden` but not themable.
15. Inline `style="min-width: 0; max-width: none; width: 100%; flex-basis: 100%;"` repeated 6 times (1138, 1233, 1266, 1359, 1406 ...): becomes `data-width=full`.
16. The empty row is a real `row` with a `gridcell` that has no `aria-colspan`; ours adds it.

**Angular mechanism (not ported)**
`ng-template`/`ngTemplateOutlet` contexts (1-204), `uiComponentOutlet` wrappers and `recycle` (10-23, 880), `@let` (46, 208), `| json` (307), `keyvalue` pipe (1291), `[class]` / `[style]` object bindings and the cached class/style maps (cmp 3099-3305), `track` expressions (replaced by `repeat` keyed by `getRowId`), `[ngModel]` on inputs (363, 372, 793), `[ariaLabel]` inputs on `ui-button`/`ui-checkbox`, `host.class` bindings, the `ViewChild` handles (`#scrollContainer`, `#resizeHandle`, `#virtualRow`), the per-cell listener set, the post-render ARIA DOM stamp (replaced by `computeGridAria`).

## 8. Open questions for the owner

1. **Visible hover/selected rows.** Keep Angular's invisible state (parity) or make cells transparent over the row colour? Recommendation: parity in wave 3 with `--ge-dt-cell-bg` as the single switch; decide after the first visual review. If the owner wants it fixed, pinned cells must stay opaque (they hide scrolled content), so only non-pinned cells go transparent.
2. **Logical vs physical in RTL.** Spec uses logical pin sides and column borders (a deliberate difference). Confirm; if parity must hold in RTL, those two rules become physical and RTL gets Angular's bugs.
3. **Where `cellClassRules` land.** Brief says "on the cell"; Angular puts them on an inner `span[cell-formatted]` (html 50) and skips them for component and renderer cells. Parity says span. Option: apply on both (`data-formatted` on the cell for consumers who style the cell). Which one?
4. **Group mode role.** `grid` + `aria-expanded` rows is invalid ARIA. Use `treegrid` whenever grouping is active (changes screen-reader keyboard expectations), or drop `aria-expanded` from group rows and expose the state on the toggle button only?
5. **Footer row counting.** Count it in `aria-rowcount` always (spec), or only outside virtual scroll as Angular's stamp seems to?
6. **New locale keys** needed for the hard-coded strings: `selectRow`, `selectAll` (exists as `selectAllRows`), `actions`, `expandRow`, `collapseRow`, `expandAllRows`, `collapseAllRows`, `expandSubRows`, `collapseSubRows`, `expandAllSubRows`, `collapseAllSubRows`, `expandGroup`, `collapseGroup`, `filterColumn` (`{column}`), `columnMenu` (`{column}`), `resizeColumn` (`{column}`), `loading`, `goToFirstPage` / `Previous` / `Next` / `LastPage`, `sortStateAscending` / `Descending` / `None`, `sortPriority`, `tableSortedAnnouncement`. Add them to the `en` dictionary and the locale completeness test now.
7. **Reference markup source.** Hand-copy the Angular rendered HTML (spec 5) or add a generator that dumps it from the Angular browser spec? Hand copy is cheaper and what `table.mjs` does; a generator is robust to Angular changes (the target has been stable since 2026-10-21).
8. **Toolbar/pager inside the grid parity.** `ge-input` host sizing (`h-8`) and `ge-select` trigger (`h-8 w-[70px]`) depend on those elements' own CSS; if they do not honour a host height, the pager and filter cases need `::part()` rules or a shared `--ge-input-height`. Check before writing the toolbar case.

## 9. Decisions on the open questions (owner delegated to the lead, 2026-11-09)

1. **Cell backgrounds.** Pinned cells stay opaque (sticky columns must hide what scrolls under them) and take row hover and selected tints through a `color-mix` of the state colour over `--background`; non-pinned cells are transparent so row hover and selected colours show. Angular's opaque `bg-background` on every cell hides them; this is a visual deviation on hovered and selected rows only (asked the Angular maintainers whether it is intended).
2. **RTL.** Keep the logical properties (start/end for pinned columns and column borders): a deliberate fix. Parity cases are LTR; RTL is covered by browser tests, not pixel parity.
3. **`cellClassRules` target.** Follow Angular: the classes go on the inner `span[cell-formatted]`, so consumers' class strings behave as they do there.
4. **ARIA for tree and grouping.** `role="treegrid"` whenever tree mode or grouping is active (rows may then carry `aria-expanded` and `aria-level`); `role="grid"` otherwise.
5. **Row count.** The footer row counts in `aria-rowcount` whenever it is rendered; under virtual scroll the count is total rows + header + footer.
6. **Locale keys.** The ~25 hard-coded English strings of Angular's template become keys of the `en` locale in wave 3 (listed in section 5 of this spec); other languages follow in wave 8.
7. **Host height of `ge-input` / `ge-select`.** Checked empirically when the toolbar and pager parity cases are built; if they do not honour it, the toolbar and pager use their own wrapper heights.
