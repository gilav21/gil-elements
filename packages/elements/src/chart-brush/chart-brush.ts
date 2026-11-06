import { html, nothing, svg, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { pointerToSvg } from '../shared/chart/chart-interaction.js';
import css from './chart-brush.css?inline';

export interface BrushSelection {
    start: number;
    end: number;
}

type BrushMode = 'idle' | 'create' | 'move' | 'resize-start' | 'resize-end';

const UP_EVENTS = ['mouseup', 'touchend', 'touchcancel'] as const;
const HANDLE = 6;

/**
 * A strip to brush a range on, for zooming or filtering a dense chart. It works in pixels along the x axis of its own
 * `width`, so set `width` to the plot width of the chart it controls and a `start` or `end` can go straight into that
 * chart's scale. Drag the track to make a selection, the band to move it, an edge to resize it.
 *
 * @fires selection-change - On every move of a drag, once more on release, and with `null` after a reset. `detail` is
 * `{ start, end }`, always with `start <= end`.
 * @attr {number} width - Width of the coordinate space, and the clamp for every selection coordinate. Defaults to 400.
 * @attr {number} height - Height of the strip in px. Defaults to 40.
 * @prop {BrushSelection | null} selection - Where the brush starts, in the same space as `width`. It only seeds the brush:
 * after the first drag or a reset the element owns the selection and later changes to this property do not move it.
 * @csspart base - The container.
 */
export class GeChartBrush extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        width: { type: Number },
        height: { type: Number },
        selection: { attribute: false },
        internal: { state: true },
    };

    declare width: number;
    declare height: number;
    declare selection: BrushSelection | null;
    /** `undefined` until the first interaction, so the `selection` property can seed the brush. */
    declare internal: BrushSelection | null | undefined;
    private mode: BrushMode = 'idle';
    private moveAnchor = 0;
    private moveOrigin: BrushSelection = { start: 0, end: 0 };
    private createAnchor = 0;

    constructor() {
        super();
        this.width = 400;
        this.height = 40;
        this.selection = null;
        this.internal = undefined;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'chart-brush-host';
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.stopTracking();
    }

    /** The selection in force, as stored (an edge dragged past its partner is only sorted on release). */
    get current(): BrushSelection | null {
        return this.internal === undefined ? this.selection : this.internal;
    }

    private clamp(x: number): number {
        return Math.max(0, Math.min(this.width, x));
    }

    private sorted(sel: BrushSelection): BrushSelection {
        return { start: Math.min(sel.start, sel.end), end: Math.max(sel.start, sel.end) };
    }

    private emitSelection(): void {
        const sel = this.internal;
        this.dispatchEvent(new CustomEvent<BrushSelection | null>('selection-change', { detail: sel ? this.sorted(sel) : null, bubbles: true, composed: true }));
    }

    /** Starts a new selection collapsed at `x`; the moves that follow sweep the other edge out from it. */
    beginCreate(x: number): void {
        this.mode = 'create';
        this.startTracking();
        this.createAnchor = this.clamp(x);
        this.internal = { start: this.createAnchor, end: this.createAnchor };
    }

    /** Starts panning the selection from `x`, keeping its width. Does nothing without a selection. */
    beginMove(x: number): void {
        const sel = this.current;
        if (!sel) return;
        this.mode = 'move';
        this.startTracking();
        this.moveAnchor = x;
        this.moveOrigin = { ...sel };
        this.internal = { ...sel };
    }

    /** Starts dragging one edge to `x` while the other stays. Does nothing without a selection. */
    beginResize(edge: 'start' | 'end', x: number): void {
        const sel = this.current;
        if (!sel) return;
        this.mode = edge === 'start' ? 'resize-start' : 'resize-end';
        this.startTracking();
        this.internal = edge === 'start' ? { start: this.clamp(x), end: sel.end } : { start: sel.start, end: this.clamp(x) };
    }

    /** Carries the gesture in progress to `x` and reports the range; ignored when no gesture is active. */
    pointerMoveTo(x: number): void {
        if (this.mode === 'idle') return;
        this.internal = this.applyMode(this.internal ?? { start: 0, end: 0 }, x);
        this.emitSelection();
    }

    private applyMode(sel: BrushSelection, x: number): BrushSelection {
        if (this.mode === 'create') return { start: this.createAnchor, end: this.clamp(x) };
        if (this.mode === 'move') {
            const delta = x - this.moveAnchor;
            return { start: this.clamp(this.moveOrigin.start + delta), end: this.clamp(this.moveOrigin.end + delta) };
        }
        if (this.mode === 'resize-start') return { start: this.clamp(x), end: sel.end };
        return { start: sel.start, end: this.clamp(x) };
    }

    /** Ends the gesture, sorting an edge that was dragged past its partner, and reports the final range. Safe to call when idle. */
    end(): void {
        if (this.mode === 'idle') return;
        if (this.internal) this.internal = this.sorted(this.internal);
        this.mode = 'idle';
        this.stopTracking();
        this.emitSelection();
    }

    /** Clears the brush and reports `null`. The `selection` property does not regain control. */
    reset(): void {
        this.mode = 'idle';
        this.stopTracking();
        this.internal = null;
        this.dispatchEvent(new CustomEvent<null>('selection-change', { detail: null, bubbles: true, composed: true }));
    }

    // Window listeners live only while a drag does: touchmove is registered non-passive so it can stop the page scrolling
    // mid-drag, which a permanent listener would make every touch scroll on the page wait for.
    private readonly onMove = (event: MouseEvent | TouchEvent) => {
        if (this.mode === 'idle') return;
        if ('touches' in event) event.preventDefault();
        this.pointerMoveTo(this.localX(event));
    };

    private readonly onUp = () => this.end();

    private startTracking(): void {
        globalThis.addEventListener('mousemove', this.onMove);
        globalThis.addEventListener('touchmove', this.onMove, { passive: false });
        for (const type of UP_EVENTS) globalThis.addEventListener(type, this.onUp);
    }

    private stopTracking(): void {
        globalThis.removeEventListener('mousemove', this.onMove);
        globalThis.removeEventListener('touchmove', this.onMove);
        for (const type of UP_EVENTS) globalThis.removeEventListener(type, this.onUp);
    }

    private localX(event: MouseEvent | TouchEvent): number {
        const svg = this.shadowRoot?.querySelector('svg');
        return svg ? pointerToSvg(event, svg).x : 0;
    }

    private readonly onCreateDown = (event: MouseEvent | TouchEvent) => {
        event.preventDefault();
        this.beginCreate(this.localX(event));
    };

    private readonly onMoveDown = (event: MouseEvent | TouchEvent) => {
        event.preventDefault();
        event.stopPropagation();
        this.beginMove(this.localX(event));
    };

    private onResizeDown(event: MouseEvent | TouchEvent, edge: 'start' | 'end'): void {
        event.preventDefault();
        event.stopPropagation();
        this.beginResize(edge, this.localX(event));
    }

    protected override render() {
        const sel = this.current;
        const band = sel ? { x: Math.min(sel.start, sel.end), width: Math.abs(sel.end - sel.start) } : null;
        return html`<div part="base" class="base">
            ${sel ? html`<button type="button" class="reset" data-slot="chart-brush-reset" aria-label="Reset zoom" @click=${() => this.reset()}>Reset</button>` : nothing}
            <svg viewBox=${`0 0 ${this.width} ${this.height}`} height=${this.height} preserveAspectRatio="none" data-slot="chart-brush" role="group" aria-label="Zoom brush">
                <rect class="track" x="0" y="0" width=${this.width} height=${this.height} @mousedown=${this.onCreateDown} @touchstart=${this.onCreateDown} />
                ${band
                    ? svg`<rect class="band" x=${band.x} y="0" width=${band.width} height=${this.height} @mousedown=${this.onMoveDown} @touchstart=${this.onMoveDown} />
                          <rect class="handle" x=${band.x - HANDLE / 2} y="0" width=${HANDLE} height=${this.height} @mousedown=${(e: MouseEvent) => this.onResizeDown(e, 'start')} @touchstart=${(e: TouchEvent) => this.onResizeDown(e, 'start')} />
                          <rect class="handle" x=${band.x + band.width - HANDLE / 2} y="0" width=${HANDLE} height=${this.height} @mousedown=${(e: MouseEvent) => this.onResizeDown(e, 'end')} @touchstart=${(e: TouchEvent) => this.onResizeDown(e, 'end')} />`
                    : nothing}
            </svg>
        </div>`;
    }
}
