import type { TemplateResult } from 'lit';
import type { DataTableCoreHost } from './data-table-host.js';
import { type ControllerId, type ControllerSpec, DEFAULT_ORDER, validatePlan } from './data-table-registry.js';

/** Plain class built as `new XController(host)`, never in the constructor of the element. */
export interface DataTableController {
    attach(): void;
    detach(): void;
    /** Runs before every render, so a controller can settle derived state the render reads. */
    hostUpdate?(): void;
}

/** A controller that also draws: the element calls these on every render. */
export interface DataTableRenderingController extends DataTableController {
    /** Drawn in the toolbar region above the grid. */
    renderToolbar?(): TemplateResult | null;
    /** Drawn over the grid in its positioned container (menus, popovers, the busy overlay, the fill handle). */
    renderOverlay?(): TemplateResult | null;
}

export type DataTableControllerFactory<T = unknown> = (host: DataTableCoreHost<T>) => DataTableRenderingController;

/** Factories by controller id. Partial while the waves land: a plan entry without a factory is skipped. */
export type DataTableControllerFactories<T = unknown> = Partial<Record<ControllerId, DataTableControllerFactory<T>>>;

export interface AssembledControllers {
    readonly controllers: readonly DataTableRenderingController[];
    /** Attaches in plan order. */
    attachAll(): void;
    /** Detaches in reverse order, each even if an earlier one threw; rethrows the first error. */
    detachAll(): void;
}

/**
 * Builds the controllers of `plan` that have a factory, in plan order. The plan is checked first, restricted to the
 * controllers actually built, so a missing factory that another one needs fails here with a message, not at attach.
 */
export function assembleControllers<T>(
    host: DataTableCoreHost<T>,
    factories: DataTableControllerFactories<T>,
    plan: readonly ControllerSpec[] = DEFAULT_ORDER,
): AssembledControllers {
    const built = plan.filter((s) => factories[s.id] !== undefined);
    const problems = validatePlan(built, { strict: false });
    if (problems.length > 0) throw new Error(`[ge-data-table] invalid controller plan:\n${problems.join('\n')}`);
    const controllers = built.map((s) => (factories[s.id] as DataTableControllerFactory<T>)(host));
    return {
        controllers,
        attachAll() {
            for (const c of controllers) c.attach();
        },
        detachAll() {
            let first: unknown;
            let failed = false;
            for (const c of [...controllers].reverse()) {
                try {
                    c.detach();
                } catch (error) {
                    if (!failed) first = error;
                    failed = true;
                }
            }
            if (failed) throw first;
        },
    };
}
