import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import { UiElement } from '@gilav21/elements-base';
import '../button/define.js';
import { isSecondaryTouch } from '../shared/touch.js';
import css from './signature-pad.css?inline';
import { isEmpty, isFarEnough, normalisePoint, strokePath, strokesToSvg, type Stroke, type StrokePoint } from './signature-pad.strokes.js';

export type SignaturePadVariant = 'outline' | 'underline' | 'ghost';
/** Image formats `toDataURL` will produce. */
export type SignatureImageType = 'image/png' | 'image/jpeg' | 'image/webp';

/**
 * A hand-drawn mark.
 *
 * `value` is a PNG data URL (or `null` when blank), because a form value has to be a scalar every backend and `<img>` accepts.
 * The strokes are the truth, though: they are kept normalised to the pad and redrawn when the size or pixel ratio changes, so the
 * signature neither blurs on a high-density screen nor vanishes when the layout moves. An image written into `value` from outside
 * cannot become strokes again, so it is drawn underneath and new strokes go on top.
 *
 * Touch works with a finger (`touch-action: none`), and a second finger abandons the stroke rather than drawing a spike across it.
 *
 * A drawn mark is irreducibly visual and motor: no label makes it accessible, so offer an alternative such as a typed name.
 *
 * @fires input - When a stroke ends, or Undo or Clear changes the signature.
 * @fires change - Same moment as `input`; the form-field convention.
 * @fires stroke-end - When a stroke finishes, after the value has been committed.
 * @attr {string} value - The signature as a `data:image/png;base64,...` URL, or empty.
 * @attr {string} pen-color - Ink colour, any CSS colour. Defaults to the current text colour.
 * @attr {number} pen-width - Ink width in CSS pixels. Defaults to `2`.
 * @attr {number} height - Pad height in CSS pixels; the width follows the container. Defaults to `180`.
 * @attr {'outline' | 'underline' | 'ghost'} variant - Border treatment. Defaults to `outline`.
 * @attr {boolean} disabled - Blocks drawing and dims the pad.
 * @attr {boolean} hide-controls - Hides the built-in Undo and Clear buttons, for your own toolbar (`undo()`, `clear()`).
 * @attr {string} clear-label - Text of the Clear button. Defaults to `Clear`.
 * @attr {string} undo-label - Text of the Undo button. Defaults to `Undo`.
 * @attr {string} name - Field name; with it the data URL is submitted with the surrounding form.
 * @attr {string} aria-label - Accessible name of the drawing surface. Defaults to `Signature`.
 * @csspart canvas - The drawing surface.
 * @cssprop --density-input - Padding multiplier of the toolbar; falls back to `--density`.
 */
export class GeSignaturePad extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static formAssociated = true;
    static override properties = {
        value: { reflect: true },
        penColor: { attribute: 'pen-color' },
        penWidth: { type: Number, attribute: 'pen-width' },
        height: { type: Number },
        variant: { reflect: true },
        disabled: { type: Boolean, reflect: true },
        hideControls: { type: Boolean, attribute: 'hide-controls' },
        clearLabel: { attribute: 'clear-label' },
        undoLabel: { attribute: 'undo-label' },
        name: { reflect: true },
        ariaLabel: { attribute: 'aria-label' },
        strokeList: { state: true },
        fieldsetDisabled: { state: true },
    };

    declare value: string | null;
    declare penColor: string;
    declare penWidth: number;
    declare height: number;
    declare variant: SignaturePadVariant;
    declare disabled: boolean;
    declare hideControls: boolean;
    declare clearLabel: string;
    declare undoLabel: string;
    declare name: string;
    declare ariaLabel: string | null;
    declare fieldsetDisabled: boolean;
    declare private strokeList: readonly Stroke[];

    private readonly canvas = createRef<HTMLCanvasElement>();
    private readonly internals?: ElementInternals;
    private defaultValue: string | null = null;
    /** An image written in that this pad did not draw: a PNG cannot become strokes, so it is drawn underneath. */
    private backdrop: HTMLImageElement | null = null;
    /** The last value this pad emitted, so its own echo is recognisable and does not replace live strokes with a flat image. */
    private lastEmitted: string | null = null;
    private activePointerId: number | null = null;
    private size = { width: 0, height: 0 };
    private observer?: ResizeObserver;

    constructor() {
        super();
        this.value = null;
        this.penColor = 'currentColor';
        this.penWidth = 2;
        this.height = 180;
        this.variant = 'outline';
        this.disabled = false;
        this.hideControls = false;
        this.clearLabel = 'Clear';
        this.undoLabel = 'Undo';
        this.name = '';
        this.ariaLabel = 'Signature';
        this.fieldsetDisabled = false;
        this.strokeList = [];
        this.internals = this.attachInternals?.();
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    /** The strokes, normalised to the pad (0 to 1 on both axes), independent of resolution. */
    get strokes(): readonly Stroke[] {
        return this.strokeList;
    }

    /** Whether anything is drawn: strokes, or an image written in. */
    get hasSignature(): boolean {
        return !isEmpty(this.strokeList) || this.backdrop !== null;
    }

    /** Whether Undo has a stroke to remove. */
    get canUndo(): boolean {
        return this.strokeList.length > 0;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.defaultValue = this.value;
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.observer?.disconnect();
        this.observer = undefined;
    }

    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    formResetCallback(): void {
        this.value = this.defaultValue;
    }

    /** Erase everything, including an image that was written in. */
    clear(): void {
        this.strokeList = [];
        this.backdrop = null;
        this.paint();
        this.commit();
    }

    /** Remove the last stroke. An image written in is not a stroke and stays. */
    undo(): void {
        if (!this.canUndo) return;
        this.strokeList = this.strokeList.slice(0, -1);
        this.paint();
        this.commit();
    }

    /** The signature in another format. `'svg'` is line art: a tenth the size, and what a PDF wants. `null` while blank. */
    toDataURL(type: SignatureImageType | 'svg' = 'image/png'): string | null {
        if (!this.hasSignature) return null;
        if (type !== 'svg') return this.canvas.value?.toDataURL(type) ?? null;
        const { width, height } = this.size;
        const svg = strokesToSvg(this.strokeList, width, height, this.resolvedPenColor(), this.penWidth);
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('value')) {
            this.internals?.setFormValue(this.value ?? '');
            this.adopt(this.value);
        }
    }

    protected override firstUpdated(): void {
        const canvas = this.canvas.value;
        if (!canvas || typeof ResizeObserver === 'undefined') return;
        this.observer = new ResizeObserver(() => {
            this.measure();
            this.paint();
        });
        this.observer.observe(canvas);
        this.paint();
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('penColor') || changed.has('penWidth') || changed.has('height')) this.paint();
    }

    protected override render() {
        return html`<div class="pad" data-slot="signature-pad" data-variant=${this.variant} aria-disabled=${this.isDisabled ? 'true' : nothing}>
            <canvas
                ${ref(this.canvas)}
                part="canvas"
                tabindex="0"
                role="img"
                data-slot="signature-pad-canvas"
                aria-label=${this.ariaLabel ?? nothing}
                style="height:${this.height}px"
                @pointerdown=${this.onPointerDown}
                @pointermove=${this.onPointerMove}
                @pointerup=${this.onPointerUp}
                @pointercancel=${this.onPointerUp}
                @pointerleave=${this.onPointerUp}
            ></canvas>
            ${this.hideControls
                ? nothing
                : html`<div class="controls">
                      <ge-button variant="ghost" size="sm" data-slot="signature-pad-undo" ?disabled=${this.isDisabled || !this.canUndo} @click=${this.undo}>${this.undoLabel}</ge-button>
                      <ge-button variant="ghost" size="sm" data-slot="signature-pad-clear" ?disabled=${this.isDisabled || !this.hasSignature} @click=${this.clear}>${this.clearLabel}</ge-button>
                  </div>`}
        </div>`;
    }

    private readonly onPointerDown = (event: PointerEvent) => {
        if (this.isDisabled) return;
        // A second finger abandons the stroke: without this a pinch drags a spike across the signature.
        if (isSecondaryTouch(event)) {
            this.abandon();
            return;
        }
        event.preventDefault();
        this.activePointerId = event.pointerId;
        this.capture(event);
        this.strokeList = [...this.strokeList, [this.pointOf(event)]];
        this.paint();
    };

    private readonly onPointerMove = (event: PointerEvent) => {
        if (this.activePointerId !== event.pointerId) return;
        event.preventDefault();
        const point = this.pointOf(event);
        const current = this.strokeList.at(-1);
        if (!current || !isFarEnough(current.at(-1), point)) return;
        this.strokeList = [...this.strokeList.slice(0, -1), [...current, point]];
        this.paint();
    };

    private readonly onPointerUp = (event: PointerEvent) => {
        if (this.activePointerId !== event.pointerId) return;
        this.activePointerId = null;
        this.commit();
        this.dispatchEvent(new Event('stroke-end', { bubbles: true, composed: true }));
    };

    /** `currentColor` is not a colour a canvas or an SVG file can resolve. */
    private resolvedPenColor(): string {
        if (this.penColor !== 'currentColor') return this.penColor;
        return getComputedStyle(this).color || '#000000';
    }

    /** Takes on a value from outside; an echo of this pad's own commit is ignored so Undo keeps working. */
    private adopt(value: string | null): void {
        if (value === this.lastEmitted) return;
        if (!value) {
            this.strokeList = [];
            this.backdrop = null;
            this.paint();
            return;
        }
        const image = new Image();
        image.addEventListener('load', () => {
            if (this.value !== value) return;
            this.backdrop = image;
            this.strokeList = [];
            this.paint();
            this.requestUpdate();
        });
        image.src = value;
    }

    private abandon(): void {
        if (this.activePointerId === null) return;
        this.activePointerId = null;
        this.strokeList = this.strokeList.slice(0, -1);
        this.paint();
    }

    private capture(event: PointerEvent): void {
        // Capture can fail for a pointer that is already gone; the stroke then simply stops tracking outside the pad.
        try {
            this.canvas.value?.setPointerCapture(event.pointerId);
        } catch {
            // Nothing to recover.
        }
    }

    /** Where a pointer is, as a fraction of the pad, against the live bounding rect rather than offsetX/Y (which depend on what was hit). */
    private pointOf(event: PointerEvent): StrokePoint {
        const rect = this.canvas.value?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return normalisePoint(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
    }

    private measure(): void {
        const rect = this.canvas.value?.getBoundingClientRect();
        if (rect) this.size = { width: rect.width, height: rect.height };
    }

    /** Keeps the bitmap at devicePixelRatio times the CSS box, redrawn from the strokes, so a signature is sharp on any screen. */
    private paint(): void {
        const canvas = this.canvas.value;
        if (!canvas) return;
        if (this.size.width === 0) this.measure();
        const { width, height } = this.size;
        if (width === 0 || height === 0) return;
        const ratio = globalThis.devicePixelRatio || 1;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        const context = canvas.getContext('2d');
        if (!context) return;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, width, height);
        if (this.backdrop) context.drawImage(this.backdrop, 0, 0, width, height);
        context.strokeStyle = this.resolvedPenColor();
        context.lineWidth = this.penWidth;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        for (const stroke of this.strokeList) {
            if (stroke.length > 0) context.stroke(new Path2D(this.canvasPath(stroke, width, height)));
        }
    }

    /**
     * The path to draw. A zero-length line draws nothing in Chromium whatever the cap, so a tap (a one-point stroke: the dot of an `i`)
     * is drawn as a hair-long line, which the round cap turns into a dot.
     */
    private canvasPath(stroke: Stroke, width: number, height: number): string {
        const only = stroke.length === 1 ? stroke[0] : undefined;
        return only ? `M${only.x * width},${only.y * height}h0.01` : strokePath(stroke, width, height);
    }

    /** The one path a user change takes: remember the URL so the echo is recognised, then announce. */
    private commit(): void {
        const next = this.hasSignature ? (this.canvas.value?.toDataURL('image/png') ?? null) : null;
        this.lastEmitted = next;
        this.value = next;
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.dispatchEvent(new Event('change', { bubbles: true }));
    }
}
