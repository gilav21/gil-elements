import type { LocaleMeta } from '../shared/calendar-locales.js';
import { pickLocale } from '../shared/locale-lookup.js';

export { interpolate } from '../shared/interpolate.js';

/** Labels of the advanced AND/OR filter builder and its toolbar chrome. */
export interface FilterBuilderLabels {
    and: string;
    or: string;
    matchAll: string;
    matchAny: string;
    addCondition: string;
    addGroup: string;
    removeGroup: string;
    removeCondition: string;
    valuePlaceholder: string;
    /** Toolbar trigger button label. */
    filterButton: string;
    /** "Clear all filters" link below the builder. */
    clearFilters: string;
    operators: {
        contains: string;
        notContains: string;
        equals: string;
        notEquals: string;
        startsWith: string;
        endsWith: string;
        gt: string;
        gte: string;
        lt: string;
        lte: string;
        isEmpty: string;
        isNotEmpty: string;
    };
}

/** Strings of `ge-data-table` and its sub-elements. Optional keys fall back to English when a dictionary omits them. */
export interface DataTableLocale extends LocaleMeta {
    filterPlaceholder: string;
    columnsLabel: string;
    noResultsLabel: string;
    rowsPerPageLabel: string;
    pageLabel: string;
    ofLabel: string;
    sortAscending: string;
    sortDescending: string;
    clearSort: string;
    pinLeft: string;
    pinRight: string;
    unpin: string;
    hideColumn: string;
    showAllColumns: string;
    /** `aria-label` on the per-column visibility checkbox. Interpolates `{column}`. */
    toggleColumnAriaLabel: string;
    /** `aria-label` on the column-visibility popover trigger. */
    toggleColumns: string;
    searchPlaceholder: string;
    /** Multiselect-filter "Select all" button label. */
    selectAllRows: string;
    /** Multiselect-filter "Clear" button label (not `clearSort`). */
    clearAll: string;
    /** `aria-label` of a row's selection checkbox. */
    selectRow: string;
    /** Screen-reader label of the actions column header. */
    actions: string;
    expandRow: string;
    collapseRow: string;
    expandAllRows: string;
    collapseAllRows: string;
    expandSubRows: string;
    collapseSubRows: string;
    expandAllSubRows: string;
    collapseAllSubRows: string;
    expandGroup: string;
    collapseGroup: string;
    /** Interpolates `{column}`. */
    filterColumn: string;
    /** Interpolates `{column}`. */
    columnMenu: string;
    /** Accessible name of the resize handle; interpolates `{column}`. */
    resizeColumn: string;
    /** `aria-description` of the resize handle: the gestures. */
    resizeColumnDescription: string;
    /** `aria-keyshortcuts` hint text of a reorderable header's controls. */
    reorderColumnHint: string;
    /** Live-region messages of wave 4. Interpolate `{page}` `{pages}`, `{count}`, `{column}` `{position}` `{total}` and `{column}` `{width}`. */
    pageAnnouncement: string;
    selectionAnnouncement: string;
    /** The singular form, for a count of one. */
    selectionAnnouncementOne: string;
    selectionClearedAnnouncement: string;
    columnMovedAnnouncement: string;
    columnResizedAnnouncement: string;
    /** Text of the default loading overlay. */
    loading: string;
    goToFirstPage: string;
    goToPreviousPage: string;
    goToNextPage: string;
    goToLastPage: string;
    /** Sort button labels; each interpolates `{title}` and, for the sorted ones, `{priority}` (see `sortPriority`). */
    sortStateAscending: string;
    sortStateDescending: string;
    sortStateNone: string;
    /** The `{priority}` part of a multi-sort label; interpolates `{index}`. */
    sortPriority: string;
    /** Live-region messages; each interpolates `{column}`. */
    sortedAscendingAnnouncement: string;
    sortedDescendingAnnouncement: string;
    sortRemovedAnnouncement: string;
    filterClearedAnnouncement: string;
    /** Interpolates `{count}` and `{value}`. */
    filterResultsAnnouncement: string;
    /** The singular form, for a count of one. */
    filterResultAnnouncement: string;
    rangeCount?: string;
    rangeSum?: string;
    rangeAvg?: string;
    rangeMin?: string;
    rangeMax?: string;
    /** Label and aria text of the "Chart" action in the range readout. */
    rangeChart?: string;
    /** Placeholder of the AI natural-language filter box. */
    nlFilterPlaceholder?: string;
    advancedFilter?: FilterBuilderLabels;
}

export const EN_FILTER_BUILDER_LABELS: FilterBuilderLabels = {
    and: 'AND',
    or: 'OR',
    matchAll: 'match all of the rules below',
    matchAny: 'match any of the rules below',
    addCondition: '+ Condition',
    addGroup: '+ Group',
    removeGroup: 'Remove group',
    removeCondition: 'Remove condition',
    valuePlaceholder: 'value',
    filterButton: 'Filter',
    clearFilters: 'Clear all filters',
    operators: {
        contains: 'contains',
        notContains: 'does not contain',
        equals: 'equals',
        notEquals: 'not equals',
        startsWith: 'starts with',
        endsWith: 'ends with',
        gt: 'greater than',
        gte: 'greater or equal',
        lt: 'less than',
        lte: 'less or equal',
        isEmpty: 'is empty',
        isNotEmpty: 'is not empty',
    },
};

const en: DataTableLocale = {
    code: 'en',
    filterPlaceholder: 'Filter...',
    columnsLabel: 'Columns',
    noResultsLabel: 'No results found.',
    rowsPerPageLabel: 'Rows per page',
    pageLabel: 'Page',
    ofLabel: 'of',
    sortAscending: 'Sort Ascending',
    sortDescending: 'Sort Descending',
    clearSort: 'Clear Sort',
    pinLeft: 'Pin Left',
    pinRight: 'Pin Right',
    unpin: 'Unpin',
    hideColumn: 'Hide Column',
    showAllColumns: 'Show All Columns',
    toggleColumnAriaLabel: 'Toggle {column} column',
    toggleColumns: 'Toggle columns',
    searchPlaceholder: 'Search...',
    selectAllRows: 'Select all',
    clearAll: 'Clear',
    selectRow: 'Select row',
    actions: 'Actions',
    expandRow: 'Expand row',
    collapseRow: 'Collapse row',
    expandAllRows: 'Expand all rows',
    collapseAllRows: 'Collapse all rows',
    expandSubRows: 'Expand sub-rows',
    collapseSubRows: 'Collapse sub-rows',
    expandAllSubRows: 'Expand all sub-rows',
    collapseAllSubRows: 'Collapse all sub-rows',
    expandGroup: 'Expand group',
    collapseGroup: 'Collapse group',
    filterColumn: 'Filter {column}',
    columnMenu: 'Column menu for {column}',
    resizeColumn: 'Resize {column} column',
    resizeColumnDescription: 'Double-click or double-tap to fit to content. Arrow keys resize.',
    reorderColumnHint: 'Alt+Shift+Left or Right arrow moves this column',
    pageAnnouncement: 'Page {page} of {pages}',
    selectionAnnouncement: '{count} rows selected',
    selectionAnnouncementOne: '1 row selected',
    selectionClearedAnnouncement: 'Selection cleared',
    columnMovedAnnouncement: '{column} moved to position {position} of {total}',
    columnResizedAnnouncement: '{column} width {width} pixels',
    loading: 'Loading...',
    goToFirstPage: 'Go to first page',
    goToPreviousPage: 'Go to previous page',
    goToNextPage: 'Go to next page',
    goToLastPage: 'Go to last page',
    sortStateAscending: '{title}, sorted ascending{priority}. Activate to sort descending.',
    sortStateDescending: '{title}, sorted descending{priority}. Activate to remove sort.',
    sortStateNone: '{title}, not sorted. Activate to sort ascending.',
    sortPriority: ', sort priority {index}',
    sortedAscendingAnnouncement: 'Table sorted by {column}, ascending',
    sortedDescendingAnnouncement: 'Table sorted by {column}, descending',
    sortRemovedAnnouncement: 'Sorting removed from {column}',
    filterClearedAnnouncement: 'Filter cleared, showing all rows',
    filterResultsAnnouncement: '{count} results found for "{value}"',
    filterResultAnnouncement: '{count} result found for "{value}"',
    rangeCount: 'Count',
    rangeSum: 'Sum',
    rangeAvg: 'Avg',
    rangeMin: 'Min',
    rangeMax: 'Max',
    rangeChart: 'Chart',
    nlFilterPlaceholder: 'Ask in plain English…',
    advancedFilter: EN_FILTER_BUILDER_LABELS,
};

/**
 * Built-in dictionaries by language id. English only; the other languages are opt-in modules that call
 * {@link registerDataTableLocale} as a side effect.
 */
export const DATA_TABLE_LOCALES: Record<string, DataTableLocale | undefined> & { en: DataTableLocale } = { en };

/** Registers (or replaces) the dictionary for a language id; the id is matched case-insensitively. */
export function registerDataTableLocale(code: string, dict: DataTableLocale): void {
    DATA_TABLE_LOCALES[code.toLowerCase()] = dict;
}

/** An object is used as it is; an id is looked up (region ignored); anything else follows the page's `lang`, then English. */
export function resolveDataTableLocale(input?: string | DataTableLocale | null): DataTableLocale {
    return pickLocale(DATA_TABLE_LOCALES, input);
}

/** The advanced-filter labels of a locale, English for any it omits (a partial dictionary stays usable). */
export function filterBuilderLabels(locale: DataTableLocale): FilterBuilderLabels {
    const own = locale.advancedFilter;
    return own
        ? { ...EN_FILTER_BUILDER_LABELS, ...own, operators: { ...EN_FILTER_BUILDER_LABELS.operators, ...own.operators } }
        : EN_FILTER_BUILDER_LABELS;
}

/**
 * A locale with every optional key filled from English. A partial dictionary (a custom object) must not render
 * `undefined` in the range readout.
 */
export function withEnglishFallback(locale: DataTableLocale): DataTableLocale {
    return { ...en, ...locale, advancedFilter: filterBuilderLabels(locale) };
}
