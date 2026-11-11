/**
 * Cell range selection, the fill handle and the range readout (wave 6, package A owns this file). Joint step 0: a shell that
 * answers "no range" and touches nothing. Wave 6 loads its implementation (`lazy/range.ts`) through `lazyPart` when
 * `enable-cell-range-selection` or `enable-fill-handle` is on; this shell stays static and always provides the `range` service, so
 * the other waves can read it without checking that it exists. See `data-table-cell-session.ts` for the contract and
 * `KEY_PRIORITY.range` for the keys it will own.
 */
import type { CellSession, InteractionContext } from './data-table-cell-session.js';
import { lazyPart } from './data-table-lazy.js';
import type { CellInteractionService, RangeService } from './data-table-providers.js';
import type { RangePart } from './lazy/range.js';

export class RangeSession<T> implements CellSession {
    /** Loaded when a range flag is on at an update (not at the first gesture), detached when it turns off or the table detaches. */
    private readonly lazy = lazyPart<RangePart<T>>(() => import('./lazy/range.js').then((m) => new m.RangePart(this.context)));

    // wave 6: the shell's service methods delegate to `this.lazy.part` once the part implements them.
    constructor(protected readonly context: InteractionContext<T>) {}

    readonly service: Pick<CellInteractionService, 'cellRange' | 'isCellSelected'> = {
        cellRange: () => null,
        isCellSelected: () => false,
    };

    readonly rangeService: RangeService = {
        range: () => null,
        normalized: () => null,
        isInRange: () => false,
        isFillPreview: () => false,
        setRange: () => undefined,
        extendTo: () => undefined,
        stats: () => null,
        chartPayload: () => null,
        openChart: () => undefined,
        fillDownTo: () => false,
        fillHandleCell: () => null,
        gestureActive: () => false,
    };

    attach(): void {}

    hostUpdate(): void {
        const { config } = this.context.host;
        this.lazy.sync(config.enableCellRangeSelection || config.enableFillHandle);
    }

    detach(): void {
        this.lazy.dispose();
    }
}
