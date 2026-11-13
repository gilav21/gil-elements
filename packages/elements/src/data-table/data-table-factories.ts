import { AddonHostController } from './data-table-addon-host-controller.js';
import { AriaController } from './data-table-aria-controller.js';
import { CellInteractionController } from './data-table-cell-interaction-controller.js';
import { ClipboardController } from './data-table-clipboard-controller.js';
import { ColumnDragController } from './data-table-column-drag-controller.js';
import { ColumnsController } from './data-table-columns-controller.js';
import type { DataTableControllerFactories } from './data-table-controllers.js';
import { DiagnosticsController } from './data-table-diagnostics-controller.js';
import { ExpansionController } from './data-table-expansion-controller.js';
import { FilterUiController } from './data-table-filter-controller.js';
import { FooterController } from './data-table-footer-controller.js';
import { FormattingController } from './data-table-formatting-controller.js';
import { LoadingController } from './data-table-loading-controller.js';
import { QueryController } from './data-table-query-controller.js';
import { ResizeController } from './data-table-resize-controller.js';
import { RowDragController } from './data-table-row-drag-controller.js';
import { SelectionController } from './data-table-selection-controller.js';
import { VirtualController } from './data-table-virtual-controller.js';

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
        selection: (host) => new SelectionController(host),
        expansion: (host) => new ExpansionController(host),

        // wave 4, package B (window and focus): virtual, cell-interaction, diagnostics
        virtual: (host) => new VirtualController(host),
        'cell-interaction': (host) => new CellInteractionController(host),
        diagnostics: (host) => new DiagnosticsController(host),

        // wave 4, package C (columns): resize, column-drag, aria
        resize: (host) => new ResizeController(host),
        'column-drag': (host) => new ColumnDragController(host),
        aria: (host) => new AriaController(host),

        // wave 5, package A (filters): filter-ui
        'filter-ui': (host) => new FilterUiController(host),

        // wave 6, package B (clipboard): clipboard
        clipboard: (host) => new ClipboardController(host),

        // wave 6, package C (drag and flash): row-drag
        'row-drag': (host) => new RowDragController(host),

        // wave 7, package D (AI): ai (its line goes here)

        // wave 7, step 0: addon-host
        'addon-host': (host) => new AddonHostController(host),
    };
}
