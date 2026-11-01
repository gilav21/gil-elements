import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import { UiElement } from '@gilav21/elements-base';
import { resolveIdRefs } from '../shared/aria-refs.js';
import { snapToStep, stepFrom, type StepGrid } from '../shared/numeric-step.js';
import css from './slider.css?inline';

const PAGE_STEPS = 10;

/**
 * A single-value slider.
 *
 * Drag the thumb or press anywhere on the track, with a mouse or a finger. A visually hidden native
 * range input carries focus and the keys, so assistive technology sees a slider: arrows step,
 * PageUp and PageDown move ten steps, Home and End jump to the ends. Left and Right swap in
 * right-to-left text.
 *
 * @fires input - Each time the user changes the value, while dragging as well.
 * @fires change - When the user finishes a change: pointer released or a key pressed.
 * @attr {number} value - Current value; always shown snapped to the step grid and clamped to the range.
 * @attr {number} min - Lowest value. Defaults to `0`.
 * @attr {number} max - Highest value. Defaults to `100`.
 * @attr {number} step - Grid spacing. Defaults to `1`.
 * @attr {boolean} disabled - Blocks interaction and dims the slider.
 * @attr {string} name - Field name; with it the value is submitted with the surrounding form.
 * @attr {string} locale - BCP 47 tag for the spoken value. Defaults to the page language.
 * @attr {string} aria-label - Accessible name.
 * @attr {string} aria-labelledby - Space-separated ids in the host's tree; resolved to elements for the inner input.
 * @csspart track - The bar.
 * @csspart range - The filled part of the bar.
 * @csspart thumb - The draggable circle.
 * @cssprop --density-slider - Track and thumb size multiplier; falls back to `--density`.
 */
export class GeSlider extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static formAssociated = true;
    static override properties = {
        value: { type: Number, reflect: true },
        min: { type: Number },
        max: { type: Number },
        step: { type: Number },
        disabled: { type: Boolean, reflect: true },
        name: { reflect: true },
        locale: {},
        ariaLabel: { attribute: 'aria-label' },
        ariaLabelledby: { attribute: 'aria-labelledby' },
        fieldsetDisabled: { state: true },
    };

    declare value: number;
    declare min: number;
    declare max: number;
    declare step: number;
    declare disabled: boolean;
    declare name: string;
    declare locale: string;
    declare ariaLabel: string | null;
    declare ariaLabelledby: string | null;
    declare fieldsetDisabled: boolean;

    private readonly rangeInput = createRef<HTMLInputElement>();
    private readonly rootEl = createRef<HTMLElement>();
    private readonly internals?: ElementInternals;
    private defaultValue?: number;
    private drag: AbortController | null = null;

    constructor() {
        super();
        this.value = 0;
        this.min = 0;
        this.max = 100;
        this.step = 1;
        this.disabled = false;
        this.name = '';
        this.locale = '';
        this.ariaLabel = null;
        this.ariaLabelledby = null;
        this.fieldsetDisabled = false;
        // Not available while server rendering.
        this.internals = this.attachInternals?.();
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    /** The value as shown: snapped onto the grid and clamped, whatever was written. */
    get rendered(): number {
        return snapToStep(this.value, this.grid);
    }

    private get grid(): StepGrid {
        return { min: this.min, max: this.max, step: this.step };
    }

    private get rtl(): boolean {
        return getComputedStyle(this).direction === 'rtl';
    }

    private get percentage(): number {
        if (this.min >= this.max) {
            console.error('[ge-slider] min should be less than max');
            return 0;
        }
        return Math.max(0, Math.min(100, ((this.rendered - this.min) / (this.max - this.min)) * 100));
    }

    /** Called by the browser when a `<fieldset disabled>` ancestor starts or stops covering this control. */
    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    /** Called by the browser when the form is reset: back to the value the markup first declared. */
    formResetCallback(): void {
        this.value = this.defaultValue ?? 0;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.defaultValue ??= this.value;
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        // Released with the button still held, or navigated away mid-drag: the document listeners must not outlive the element.
        this.cancelDrag();
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('value') || changed.has('min') || changed.has('max') || changed.has('step')) {
            this.internals?.setFormValue(String(this.rendered));
        }
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('ariaLabelledby') && this.rangeInput.value) {
            this.rangeInput.value.ariaLabelledByElements = resolveIdRefs(this, this.ariaLabelledby);
        }
    }

    private get valueText(): string {
        return new Intl.NumberFormat(this.locale || document.documentElement.lang || undefined).format(this.rendered);
    }

    protected override render() {
        const rtl = this.rtl;
        const percent = this.percentage;
        const side = rtl ? 'right' : 'left';
        return html`<div
            class=${this.isDisabled ? 'root disabled' : 'root'}
            data-slot="slider"
            ${ref(this.rootEl)}
            @mousedown=${this.onTrackMouseDown}
            @touchstart=${this.onTouchStart}
        >
            <input
                ${ref(this.rangeInput)}
                type="range"
                class="range"
                .min=${String(this.min)}
                .max=${String(this.max)}
                .step=${String(this.step)}
                .value=${String(this.rendered)}
                ?disabled=${this.isDisabled}
                aria-label=${this.ariaLabel ?? nothing}
                aria-valuetext=${this.valueText}
                @keydown=${this.onKeydown}
                @input=${this.onNativeInput}
            />
            <div class="track" part="track" data-slot="slider-track">
                <div class="fill" part="range" style="${side}: 0; width: ${percent}%"></div>
            </div>
            <div
                class="thumb"
                part="thumb"
                data-slot="slider-thumb"
                style="${side}: ${percent}%; transform: translateX(${rtl ? '50%' : '-50%'})"
                @mousedown=${this.onThumbMouseDown}
            ></div>
        </div>`;
    }

    private readonly onTrackMouseDown = (event: MouseEvent) => {
        if (this.isDisabled) return;
        event.preventDefault();
        this.moveTo(event.clientX);
        this.startMouseDrag();
        this.rangeInput.value?.focus();
    };

    private readonly onThumbMouseDown = (event: MouseEvent) => {
        if (this.isDisabled) return;
        event.preventDefault();
        event.stopPropagation();
        this.startMouseDrag();
        this.rangeInput.value?.focus();
    };

    private readonly onTouchStart = (event: TouchEvent) => {
        if (this.isDisabled) return;
        event.preventDefault();
        const first = event.touches[0];
        if (first) this.moveTo(first.clientX);
        const signal = this.beginDrag();
        document.addEventListener('touchmove', (move) => {
            const touch = move.touches[0];
            if (touch) this.moveTo(touch.clientX);
        }, { signal });
        document.addEventListener('touchend', () => this.endDrag(), { signal });
        document.addEventListener('touchcancel', () => this.cancelDrag(), { signal });
    };

    private startMouseDrag(): void {
        const signal = this.beginDrag();
        document.addEventListener('mousemove', (move) => this.moveTo(move.clientX), { signal });
        document.addEventListener('mouseup', () => this.endDrag(), { signal });
    }

    private beginDrag(): AbortSignal {
        this.cancelDrag();
        this.drag = new AbortController();
        return this.drag.signal;
    }

    private cancelDrag(): void {
        this.drag?.abort();
        this.drag = null;
    }

    private endDrag(): void {
        this.cancelDrag();
        this.dispatchEvent(new Event('change', { bubbles: true }));
    }

    private moveTo(clientX: number): void {
        const track = this.rootEl.value;
        if (!track) return;
        const rect = track.getBoundingClientRect();
        const raw = (clientX - rect.left) / rect.width;
        // Beyond either end the fraction runs past 0..1; snapping clamps it to the range.
        const fraction = this.rtl ? 1 - raw : raw;
        this.commit(snapToStep(this.min + fraction * (this.max - this.min), this.grid));
    }

    // The native input event crosses the shadow boundary; the host announces the change itself, once.
    private readonly onNativeInput = (event: Event) => {
        event.stopPropagation();
        if (this.isDisabled) return;
        this.commit(snapToStep((event.target as HTMLInputElement).valueAsNumber, this.grid));
    };

    private readonly onKeydown = (event: KeyboardEvent) => {
        if (this.isDisabled) return;
        const next = this.keyTarget(event.key);
        if (next === undefined) return;
        event.preventDefault();
        if (this.commit(next)) this.dispatchEvent(new Event('change', { bubbles: true }));
    };

    private keyTarget(key: string): number | undefined {
        const grid = this.grid;
        const from = this.rendered;
        const forward = this.rtl ? -1 : 1;
        switch (key) {
            case 'ArrowUp':
                return stepFrom(from, 1, 1, grid);
            case 'ArrowDown':
                return stepFrom(from, -1, 1, grid);
            case 'ArrowRight':
                return stepFrom(from, forward, 1, grid);
            case 'ArrowLeft':
                return stepFrom(from, forward === 1 ? -1 : 1, 1, grid);
            case 'PageUp':
                return stepFrom(from, 1, PAGE_STEPS, grid);
            case 'PageDown':
                return stepFrom(from, -1, PAGE_STEPS, grid);
            case 'Home':
                return snapToStep(Number.NEGATIVE_INFINITY, grid);
            case 'End':
                return snapToStep(Number.POSITIVE_INFINITY, grid);
            default:
                return undefined;
        }
    }

    /** Applies a user change and announces it; returns whether the value actually moved. */
    private commit(next: number): boolean {
        if (next === this.rendered) return false;
        this.value = next;
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        return true;
    }
}
