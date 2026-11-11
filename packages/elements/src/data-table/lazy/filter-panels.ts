/**
 * Lazy entry of the three ready-made filter panels (wave 5, package A owns this file): `ge-data-table-date-filter`,
 * `ge-data-table-date-range-filter` and `ge-data-table-multiselect-filter`, with the `ge-calendar` and `ge-command` they use. A build
 * entry (`data-table/lazy/filter-panels`) reached through `lazyElement(tag, () => import('./lazy/filter-panels.js'))` the first time a
 * trigger carrying one of the tags is hovered, focused or opened. Joint step 0: nothing is defined yet.
 */
export {};
