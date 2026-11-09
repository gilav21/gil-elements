import { ColumnsController } from './data-table-columns-controller.js';
import type { DataTableControllerFactories } from './data-table-controllers.js';
import { FooterController } from './data-table-footer-controller.js';
import { FormattingController } from './data-table-formatting-controller.js';
import { LoadingController } from './data-table-loading-controller.js';
import { QueryController } from './data-table-query-controller.js';

/**
 * Controller id -> factory, one line each; `assembleControllers` builds those of the plan that have one, in plan order.
 * A package adds only its own lines at its marked place (the blank lines keep concurrent additions from conflicting).
 */
export function createFactories<T>(): DataTableControllerFactories<T> {
    return {
        columns: (host) => new ColumnsController(host),
        query: (host) => new QueryController(host),
        loading: (host) => new LoadingController(host),
        formatting: (host) => new FormattingController(host),
        footer: (host) => new FooterController(host),

        // wave 4, package A (rows): selection, expansion

        // wave 4, package B (window and focus): virtual, cell-interaction, diagnostics

        // wave 4, package C (columns): resize, column-drag, aria
    };
}
