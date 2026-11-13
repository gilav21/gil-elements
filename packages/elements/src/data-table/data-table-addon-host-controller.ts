import { SlotRegistry } from '../shared/registry.js';
import type { DataTableCoreHost } from './data-table-host.js';
import type { AddonsService, CellActionSlot, DataTableProviders, HeaderActionSlot } from './data-table-providers.js';

/** What the table's addons contribute: a ⋮ button in every data row's action cell and in every column header. */
export interface DataTableSlots<T> {
    readonly cellActions: SlotRegistry<CellActionSlot<T>>;
    readonly headerActions: SlotRegistry<HeaderActionSlot<T>>;
}

export function createDataTableSlots<T>(): DataTableSlots<T> {
    return { cellActions: new SlotRegistry(), headerActions: new SlotRegistry() };
}

/** The `addons` service: the slot registries plus the busy-overlay label; `onChange` is the element's re-render. */
export function createAddonsService<T>(onChange: () => void): AddonsService<T> {
    const slots = createDataTableSlots<T>();
    let busy: string | null = null;
    slots.cellActions.subscribe(onChange);
    slots.headerActions.subscribe(onChange);
    return {
        ...slots,
        busyLabel: () => busy,
        setBusy(label) {
            if (busy === label) return;
            busy = label;
            onChange();
        },
    };
}

/**
 * Provides the `addons` service: the row and header action slots addons register and the busy-overlay label. A change to
 * either re-renders the table. The service is the controller's for its whole life (`services`), so an addon's teardown at a
 * disconnect can still unregister and clear its busy label after the providers are gone.
 */
export class AddonHostController<T> {
    private readonly service: AddonsService<T>;
    readonly services: Pick<DataTableProviders, 'addons'>;
    private unprovide: (() => void) | undefined;

    constructor(private readonly host: DataTableCoreHost<T>) {
        this.service = createAddonsService<T>(() => host.requestRender());
        this.services = { addons: this.service as unknown as AddonsService<unknown> }; // the slot callbacks are typed by row; the services map is not
    }

    attach(): void {
        this.unprovide = this.host.provide('addons', this.service);
    }

    detach(): void {
        this.unprovide?.();
        this.unprovide = undefined;
    }
}
