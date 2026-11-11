import type { DataTableCoreHost } from './data-table-host.js';
import { lazyPart } from './data-table-lazy.js';
import type { RowDragService } from './data-table-providers.js';
import type { RowDragPart } from './lazy/row-drag.js';

/**
 * Row drag reorder and its keyboard alternative (wave 6, package C owns this file). Joint step 0: it provides an inert `rowDrag`
 * service; the drag part loads when `enable-row-drag` is on and does nothing yet.
 */
export class RowDragController<T> {
    private unprovide: (() => void) | undefined;
    /** `changed`: `rowDrag.active()` comes from the part, so the render that makes rows draggable has to be asked for. */
    private readonly drag = lazyPart<RowDragPart<T>>(() => import('./lazy/row-drag.js').then((m) => new m.RowDragPart(this.host)), { changed: () => this.host.requestRender() });

    constructor(protected readonly host: DataTableCoreHost<T>) {}

    private readonly service: RowDragService<T> = {
        active: () => false, // wave 6 C: true once the part is attached
        isDragging: () => false,
        dragState: () => null,
        moveRow: () => false,
        reorderData: (data) => [...data],
    };

    attach(): void {
        this.unprovide = this.host.provide('rowDrag', this.service);
    }

    hostUpdate(): void {
        this.drag.sync(this.host.config.enableRowDrag);
    }

    detach(): void {
        this.drag.dispose();
        this.unprovide?.();
    }
}
