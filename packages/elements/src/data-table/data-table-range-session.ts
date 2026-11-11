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
import type { CellSession, InteractionContext, SessionStandIn } from './data-table-cell-session.js';
import { lazyPart } from './data-table-lazy.js';
import type { CellInteractionService, RangeService } from './data-table-providers.js';
import { clampToRows, rangeColumnKeys, rangeModeOn, sameRange, sanitizeCellRange, warnBadRange } from './data-table-range.js';
import type { CellRange } from './data-table.types.js';
import type { RangePart } from './lazy/range.js';

/** The range service that does nothing and answers "nothing" with the right types (the shell is built on it; the controller's fallback when a session cannot make a stand-in). */
export const NEUTRAL_RANGE: RangeService = {
    active: () => false,
    range: () => null,
    normalized: () => null,
    isInRange: () => false,
    isFillPreview: () => false,
    edgeOf: () => '',
    setRange: () => undefined,
    extendTo: () => undefined,
    stats: () => null,
    chartPayload: () => null,
    openChart: () => undefined,
    fillDownTo: () => false,
    fillHandleCell: () => null,
    gestureActive: () => false,
};
/** The range session's methods of the `interaction` service, neutral. */
export const NEUTRAL_RANGE_CELL: Pick<CellInteractionService, 'cellRange' | 'isCellSelected'> = { cellRange: () => null, isCellSelected: () => false };

export class RangeSession<T> implements CellSession {
    /** The range while no part is attached; see the header. */
    private held: CellRange | null = null;
    /** A range flag was on at the last update. */
    private wasOn = false;
    /** `held` was assigned while a range flag was on, or adopted by an update that saw it on: the turn-off clears it. */
    private heldInMode = false;

    /** Loaded when a range flag is on at an update (not at the first gesture), detached when it turns off or the table detaches. */
    private readonly lazy = lazyPart<RangePart<T>>(() =>
        import('./lazy/range.js').then((m) => {
            const part = new m.RangePart(this.context);
            part.setRange(this.held);
            return part;
        }),
        // Right after the part attaches (it is `lazy.part` from the moment it attaches): the range held NOW goes to it (a `setRange` between the part's
        // construction and its attach reached `held` only, and the next update would have read the part's stale value back), and the arrival is drawn.
        {
            changed: () => {
                this.lazy.part?.setRange(this.held);
                this.context.host.requestRender();
            },
        },
    );

    constructor(protected readonly context: InteractionContext<T>) {}

    // wave 6: the methods below that answer "nothing" delegate to `this.lazy.part` once the part implements them.
    readonly rangeService: RangeService = {
        ...NEUTRAL_RANGE,
        range: () => this.current(),
        // What the PART says (like `rowDrag.active()`): a loaded part that does not handle ranges yet is not active, so nothing of range mode is drawn.
        active: () => this.lazy.part?.active() ?? false,
        setRange: (range) => {
            // The value is always HELD (a property order such as `cellRange = r; enableCellRangeSelection = true` must keep it); while range mode is off
            // it is only not reported, and it applies when the mode turns on. `undefined` is "no range"; anything that is not a range, or names a column
            // that is not a range of integer rows and string columns is refused (warned once) and the old value stays. The COLUMNS are not looked up here:
            // `cellRange = r; columns = [...]` in one tick (an Angular binding order) must keep `r`, so they are validated at the next update against the
            // columns of that moment (`validateColumns`). The ROWS are not looked up here either (`cellRange = r; data = newData` in one tick must not
            // trim `r` against the old data): `hostUpdate` trims them once the rows of that update are known.
            const next = sanitizeCellRange(range, 0, []);
            if (next === undefined) return warnBadRange(range);
            const changed = !sameRange(this.live(), next);
            this.held = next;
            this.heldInMode = this.rangeOn(); // assigned while range mode was off, it is not part of the mode that a later turn-off ends
            this.lazy.part?.setRange(next);
            // `data-in-range`, `aria-selected` and the readout read the range at render, and only in range mode: an equal value, or a value held while the mode is off, draws nothing new
            if (changed && this.rangeOn()) this.context.host.requestRender();
        },
    };

    /**
     * Derived from `rangeService`, so wave 6 implements one pair. `isCellSelected` is Angular's (cmp `isCellSelected`, which the context-menu
     * addon reads): with a range, whether the cell is in it; with none, whether it is the focused cell. Not gated on the range flag: the
     * focused cell is "selected" for the menu whatever the mode (the step 0 stub used to answer false always; the spec 0.3 #4 meaning wins).
     * With the flags off no range is reported, so the focused cell is what is reported. The range branch needs the range service ACTIVE (part
     * loaded): while it loads, or after a latched load failure, `isInRange` has no answer, so the focused cell is reported instead.
     */
    readonly service: Pick<CellInteractionService, 'cellRange' | 'isCellSelected'> = {
        cellRange: () => this.rangeService.range(),
        isCellSelected: (rowIndex, columnKey) => {
            if (this.rangeService.active() && this.rangeService.range()) return this.rangeService.isInRange(rowIndex, columnKey);
            const focused = this.context.focused();
            return focused?.rowIndex === rowIndex && focused.columnKey === columnKey;
        },
    };

    /** The attached part's range when there is a part (it may have cleared it: null is an answer), else the held one; whatever the range mode. */
    private live(): CellRange | null {
        const { part } = this.lazy;
        return part ? part.getRange() : this.held;
    }

    /** What is reported: the range while range mode is on, nothing while it is off. */
    private current(): CellRange | null {
        return this.rangeOn() ? this.live() : null;
    }

    /** The range and the `columns` array `validateColumns` last found valid. */
    private checked: { range: CellRange; columns: unknown } | null = null;

    /**
     * ONE column rule: a data column of `config.columns` (visible or hidden: visibility only affects drawing), never a special column. Checked at the
     * update, against the columns of that moment; a range that names a column that is not there is dropped then, with the one warning. Nothing is
     * checked while there are no columns at all (they may not have been assigned yet).
     */
    private validateColumns(): void {
        if (!this.held) return;
        const { columns } = this.context.host.config;
        // Checked once per (range, columns array): an update that changes neither has nothing new to find.
        if (this.checked?.range === this.held && this.checked.columns === columns) return;
        const keys = rangeColumnKeys(columns);
        if (keys.length === 0) return;
        if (sanitizeCellRange(this.held, 0, keys) !== undefined) {
            this.checked = { range: this.held, columns }; // remembered only once the range PASSED: an invalid one is dropped below, never skipped
            return;
        }
        warnBadRange(this.held);
        this.held = null;
        this.checked = null;
        this.lazy.part?.setRange(null);
    }

    private rangeOn(): boolean {
        return rangeModeOn(this.context.host.config);
    }


    attach(): void {}

    hostUpdate(): void {
        const on = this.rangeOn();
        if (on) {
            this.held = this.live();
            this.heldInMode = true; // what is held now belongs to range mode (a later turn-off ends it)
            this.validateColumns();
            // The SHELL trims the ROWS of the range, always, once they are known: with or without a part, so a data set that shrinks never leaves a
            // range past its rows (one place, the part need not do it). A changed range is written back to the part. The columns are not checked here:
            // one that is merely hidden at this moment must not drop the range for good.
            // No drawn rows: the range is left untouched. "No rows" is also a table before its data arrives (a fetch without `loading`), a skeleton, or
            // every group collapsed, and none of those may lose it. ACCEPTED EDGE: a range kept across a genuinely empty phase is trimmed onto the first
            // rows of a later load. With rows, the range is trimmed to them (dropped only when wholly past them). `clampToRows` answers the same object
            // when nothing changes.
            const rows = this.context.rowCount();
            if (this.held && rows > 0) {
                const trimmed = clampToRows(null, this.held, rows).range;
                if (trimmed !== this.held) {
                    this.held = trimmed;
                    this.lazy.part?.setRange(trimmed);
                }
            }
        } else if (this.wasOn) {
            // Turning range selection OFF ends range mode: the range of that mode goes with it (wave 6 A.2), so turning it on again starts empty.
            // Only a value that was held in the mode: one assigned after the mode went off (`enableCellRangeSelection = false; cellRange = r` in
            // one tick, the update only sees the turn-off now) is not part of it and waits for the next time the mode is on.
            if (this.heldInMode) this.held = null;
            this.heldInMode = false;
        }
        // (off and never on: a value assigned before the mode was switched on waits in `held`)
        this.wasOn = on;
        this.lazy.sync(on);
    }

    detach(): void {
        // A detach keeps the range (a DOM move): the next attach's part gets it back.
        this.held = this.live();
        this.lazy.dispose();
    }

    /** After a failure of this session (see `CellSession.inert`): an unattached shell that starts with the range held now (read after the detach) and keeps what is set while the session is out. */
    inert(): SessionStandIn {
        const shell = new RangeSession(this.context);
        shell.held = this.held;
        shell.heldInMode = this.heldInMode;
        return { service: shell.service, rangeService: shell.rangeService, kept: () => shell.held };
    }

    /** The range the stand-in holds (`inert().kept()`) is the range now: a value set while the session was out survives its next attach. */
    adopt(kept: unknown): void {
        this.held = kept as CellRange | null;
        this.heldInMode = this.rangeOn();
    }
}
