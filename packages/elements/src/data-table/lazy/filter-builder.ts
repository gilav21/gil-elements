/**
 * Lazy entry of the advanced filter builder (wave 5, package A owns this file): defines `ge-data-table-filter-builder`. A build entry
 * (`data-table/lazy/filter-builder`) reached through `lazyElement(tag, () => import('./lazy/filter-builder.js'))` (the `filter-ui`
 * controller) when the toolbar trigger is hovered, focused or first opened. Defining is its side effect.
 */
import { defineElement } from '@gilav21/elements-base';
import { GeDataTableFilterBuilder } from '../sub/data-table-filter-builder.js';

defineElement('data-table-filter-builder', GeDataTableFilterBuilder);

export { GeDataTableFilterBuilder };
