/**
 * Cell range selection, the fill handle and the range readout (wave 6, package A owns this file). Joint step 0: a shell that holds the
 * range and touches nothing else. Wave 6 loads its implementation (`lazy/range.ts`) through `lazyPart` when
 * `enable-cell-range-selection` or `enable-fill-handle` is on; this shell stays static and always provides the `range` service, so
 * the other waves can read it without checking that it exists. See `data-table-cell-session.ts` for the contract and
 * `KEY_PRIORITY.range` for the keys it will own.
 *
 * The shell owns the range VALUE between the part's lives: a range set before the part is loaded (the `cellRange` property, `setRange`),
 * or kept across a detach and attach (a DOM move disposes the part), is handed to the next part when it is built, and read back from the
 * part before it is disposed. The part keeps the live range while it is attached.
 */
import type { CellSession, InteractionContext } from './data-table-cell-session.js';
import { lazyPart } from './data-table-lazy.js';
import type { CellInteractionService, RangeService } from './data-table-providers.js';
import type { CellRange } from './data-table.types.js';
import type { RangePart } from './lazy/range.js';

export class RangeSession<T> implements CellSession {
    /** The range while no part is attached; see the header. */
    private held: CellRange | null = null;
    /** A range flag was on at the last update. */
    private wasOn = false;

    /** Loaded when a range flag is on at an update (not at the first gesture), detached when it turns off or the table detaches. */
    private readonly lazy = lazyPart<RangePart<T>>(() =>
        import('./lazy/range.js').then((m) => {
            const part = new m.RangePart(this.context);
            part.setRange(this.held);
            return part;
        }),
        // The overlay, the cell flags and the fill handle come from the part: its arrival and departure are drawn.
        { changed: () => this.context.host.requestRender() },
    );

    constructor(protected readonly context: InteractionContext<T>) {}

    // wave 6: the methods below that answer "nothing" delegate to `this.lazy.part` once the part implements them.
    readonly rangeService: RangeService = {
        range: () => this.current(),
        normalized: () => null,
        isInRange: () => false,
        isFillPreview: () => false,
        edgeOf: () => '',
        setRange: (range) => {
            this.held = range;
            this.lazy.part?.setRange(range);
            this.context.host.requestRender(); // `data-in-range`, `aria-selected` and the readout read the range at render
        },
        extendTo: () => undefined,
        stats: () => null,
        chartPayload: () => null,
        openChart: () => undefined,
        fillDownTo: () => false,
        fillHandleCell: () => null,
        gestureActive: () => false,
    };

    /**
     * Derived from `rangeService`, so wave 6 implements one pair. `isCellSelected` is Angular's (cmp `isCellSelected`, which the context-menu
     * addon reads): with a range, whether the cell is in it; with none, whether it is the focused cell. Not gated on the range flag: the
     * focused cell is "selected" for the menu whatever the mode (the step 0 stub used to answer false always; the spec 0.3 #4 meaning wins).
     */
    readonly service: Pick<CellInteractionService, 'cellRange' | 'isCellSelected'> = {
        cellRange: () => this.rangeService.range(),
        isCellSelected: (rowIndex, columnKey) => {
            if (this.rangeService.range()) return this.rangeService.isInRange(rowIndex, columnKey);
            const focused = this.context.focused();
            return focused?.rowIndex === rowIndex && focused.columnKey === columnKey;
        },
    };

    /** The attached part's range when there is a part (it may have cleared it: null is an answer), else the held one. */
    private current(): CellRange | null {
        const { part } = this.lazy;
        return part ? part.getRange() : this.held;
    }

    attach(): void {}

    hostUpdate(): void {
        const { config } = this.context.host;
        const on = config.enableCellRangeSelection || config.enableFillHandle;
        // Turning range selection off ends range mode: the range goes with it (wave 6 A.2), so turning it on again starts empty.
        if (!on && this.wasOn) this.held = null;
        else this.held = this.current();
        this.wasOn = on;
        this.lazy.sync(on);
    }

    detach(): void {
        // A detach keeps the range (a DOM move): the next attach's part gets it back.
        this.held = this.current();
        this.lazy.dispose();
    }
}
