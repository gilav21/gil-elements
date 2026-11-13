import type { DataTableCoreHost } from './data-table-host.js';
import type { AddonsService, DataTableProviders } from './data-table-providers.js';
import { createAddonsService } from './data-table-registry.js';

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
