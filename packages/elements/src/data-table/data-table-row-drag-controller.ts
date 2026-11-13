import type { DataTableCoreHost } from './data-table-host.js';
import { callPart, lazyPart } from './data-table-lazy.js';
import type { RowDragService } from './data-table-providers.js';
import { reorderRows } from './data-table-row-reorder.js';
import type { RowDragPart } from './lazy/row-drag.js';

/** The ONE neutral row-drag service (a frozen module constant, like the sessions' `NEUTRAL_*`): nothing is draggable, nothing moves, `reorderData` answers a copy. The controller's shell is built on it and the element uses it before the controllers exist. */
export const NEUTRAL_ROW_DRAG: Readonly<RowDragService<unknown>> = Object.freeze({
    active: () => false,
    isDragging: () => false,
    dragState: () => null,
    moveRow: () => false,
    reorderData: (data: readonly unknown[]) => [...data],
});

/** `NEUTRAL_ROW_DRAG` for a row type `T` (it never reads a row, so the one frozen object serves every `T`). */
export const neutralRowDrag = <T>(): RowDragService<T> => NEUTRAL_ROW_DRAG as RowDragService<T>;

/**
 * Row drag reorder and its keyboard alternative (wave 6, package C owns this file). The shell provides the `rowDrag` service always; the drag
 * part (`lazy/row-drag.ts`: the native drag listeners, the indicators, Alt+Arrow) loads when `enable-row-drag` is on. `reorderData` is pure
 * and lives here (eager), so the element's public `reorderData` works without the part, with the flag off and while detached (Angular's is a
 * plain method too).
 */
export class RowDragController<T> {
    private unprovide: (() => void) | undefined;
    /** `changed`: `rowDrag.active()` comes from the part, so the render that makes rows draggable has to be asked for. */
    private readonly drag = lazyPart<RowDragPart<T>>(() => import('./lazy/row-drag.js').then((m) => new m.RowDragPart(this.host)), { changed: () => this.host.requestRender() });

    constructor(protected readonly host: DataTableCoreHost<T>) {}

    private readonly service: RowDragService<T> = {
        ...neutralRowDrag<T>(),
        active: () => callPart(this.drag.part, this.host, 'row-drag-part-active', (part) => part.active(), false), // what the PART says (like the range shell): true once it handles drags
        isDragging: () => callPart(this.drag.part, this.host, 'row-drag-part-isDragging', (part) => part.isDragging(), false),
        dragState: () => callPart(this.drag.part, this.host, 'row-drag-part-dragState', (part) => part.dragState(), null),
        moveRow: (row, direction) => callPart(this.drag.part, this.host, 'row-drag-part-moveRow', (part) => part.moveRow(row, direction), false),
        reorderData: (data, event) => {
            const { config } = this.host;
            return reorderRows(data, event, { enabled: config.enableSubRows, getRowId: config.getRowId, getChildren: config.getChildren, setChildren: config.setChildren });
        },
    };

    /** The row-drag service outlives a disconnect (the controller is built once), unlike its provider entry: the element's `reorderData` / `moveRow` read it here. */
    readonly services = { rowDrag: this.service };

    attach(): void {
        this.unprovide = this.host.provide('rowDrag', this.service);
    }

    hostUpdate(): void {
        this.drag.sync(this.host.config.enableRowDrag);
        callPart(this.drag.part, this.host, 'row-drag-part-hostUpdate', (part) => part.hostUpdate(), undefined);
    }

    detach(): void {
        this.drag.dispose();
        this.unprovide?.();
    }
}
