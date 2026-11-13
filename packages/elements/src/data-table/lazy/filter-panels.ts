/**
 * Lazy entry of the three ready-made filter panels (wave 5, package A owns this file): `ge-data-table-date-filter`,
 * `ge-data-table-date-range-filter` and `ge-data-table-multiselect-filter`, with the `ge-calendar` and `ge-command` they use. A build
 * entry (`data-table/lazy/filter-panels`) reached through `lazyElement(tag, () => import('./lazy/filter-panels.js'))` (the `filter-ui`
 * controller) the first time a trigger carrying one of the tags is hovered, focused or opened. Defining is its side effect.
 */
import { defineElement } from '@gilav21/elements-base';
import { GeDataTableDateFilter } from '../sub/data-table-date-filter.js';
import { GeDataTableDateRangeFilter } from '../sub/data-table-date-range-filter.js';
import { GeDataTableMultiselectFilter } from '../sub/data-table-multiselect-filter.js';

defineElement('data-table-date-filter', GeDataTableDateFilter);
defineElement('data-table-date-range-filter', GeDataTableDateRangeFilter);
defineElement('data-table-multiselect-filter', GeDataTableMultiselectFilter);

export { GeDataTableDateFilter, GeDataTableDateRangeFilter, GeDataTableMultiselectFilter };
