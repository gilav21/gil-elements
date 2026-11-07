import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { live } from 'lit/directives/live.js';
import { UiElement } from '@gilav21/elements-base';
import css from './duration-input.css?inline';
import { LEADING_WIDTH, SEGMENT_WIDTH, fromParts, segmentMax, segmentText, toParts, type DurationParts, type DurationUnit } from './duration-input.format.js';

export type DurationInputVariant = 'outline' | 'underline' | 'ghost';

const ALL_UNITS: readonly DurationUnit[] = ['hours', 'minutes', 'seconds'];
/** The `Intl` unit each segment is spoken in, so plurals and words come from the locale. */
const INTL_UNIT: Record<DurationUnit, string> = { hours: 'hour', minutes: 'minute', seconds: 'second' };

interface Segment {
    unit: DurationUnit;
    value: number;
    text: string;
    isLeading: boolean;
    max: number;
    valueText: string;
    width: number;
}

/** Accepts `units="hours,minutes"` as an attribute; anything that names no unit leaves the default. */
function unitsFromAttribute(attribute: string | null): readonly DurationUnit[] {
    const named = (attribute ?? '').split(',').map((part) => part.trim()).filter((part): part is DurationUnit => ALL_UNITS.includes(part as DurationUnit));
    return named.length > 0 ? ALL_UNITS.filter((unit) => named.includes(unit)) : ['hours', 'minutes'];
}

/** Wide enough for the digits it holds (the leading segment has no fixed width), plus one for the caret. */
function boxWidth(text: string, placeholder: string): number {
    return Math.max(2, text.length, placeholder.length) + 1;
}

/**
 * A length of time, edited one unit at a time.
 *
 * `value` is in seconds (`null` shows empty segments). Each unit is its own numeric field, so there is no guessing what
 * `130` means: the caret is in the minutes box, so the digits are minutes. Arrow Up and Down step the segment under the
 * caret, wrapping a bounded one (59 minutes up reads 0). Only the leading segment is unbounded, and it absorbs the units
 * that are not shown: with `units="minutes,seconds"` 90 minutes reads `90:00`.
 *
 * @fires input - Each time the value changes.
 * @fires change - When focus leaves the whole control with a different value than it entered with.
 * @attr {number} value - The duration in seconds; absent means empty.
 * @attr {string} units - Comma-separated units to show, largest first. Defaults to `hours,minutes`.
 * @attr {string} locale - BCP 47 tag the spoken value (`aria-valuetext`) is written in. Defaults to the page language, then `en`.
 * @attr {'outline' | 'underline' | 'ghost'} variant - Border treatment. Defaults to `outline`.
 * @attr {boolean} disabled - Blocks editing and dims the group.
 * @attr {string} name - Field name; with it the value in seconds is submitted with the surrounding form.
 * @attr {string} aria-label - Accessible name of the group. Defaults to `Duration`.
 * @cssprop --density-input - Height and padding multiplier; falls back to `--density`.
 */
export class GeDurationInput extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static readonly formAssociated = true;
    static override readonly properties = {
        value: {
            reflect: true,
            converter: {
                fromAttribute: (attribute: string | null): number | null => (attribute === null || attribute.trim() === '' || Number.isNaN(Number(attribute)) ? null : Number(attribute)),
                toAttribute: (value: number | null): string | null => (value === null ? null : String(value)),
            },
        },
        units: { converter: { fromAttribute: unitsFromAttribute, toAttribute: (units: readonly DurationUnit[]) => units.join(',') } },
        locale: {},
        variant: { reflect: true },
        disabled: { type: Boolean, reflect: true },
        name: { reflect: true },
        ariaLabel: { attribute: 'aria-label' },
        fieldsetDisabled: { state: true },
    };
    private static instances = 0;

    declare value: number | null;
    declare units: readonly DurationUnit[];
    declare locale: string;
    declare variant: DurationInputVariant;
    declare disabled: boolean;
    declare name: string;
    declare ariaLabel: string | null;
    declare fieldsetDisabled: boolean;

    private readonly internals?: ElementInternals;
    private readonly valueTextId = `ge-duration-input-value-${++GeDurationInput.instances}`;
    private defaultValue?: number | null;
    private valueAtFocus: number | null = null;

    constructor() {
        super();
        this.value = null;
        this.units = ['hours', 'minutes'];
        this.locale = '';
        this.variant = 'outline';
        this.disabled = false;
        this.name = '';
        this.ariaLabel = 'Duration';
        this.fieldsetDisabled = false;
        this.internals = this.attachInternals?.();
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    /** The segment inputs, largest unit first. */
    get segmentInputs(): HTMLInputElement[] {
        return [...(this.shadowRoot?.querySelectorAll<HTMLInputElement>('input') ?? [])];
    }

    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    formResetCallback(): void {
        this.value = this.defaultValue ?? null;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.defaultValue ??= this.value;
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('value')) this.internals?.setFormValue(this.value === null ? '' : String(this.value));
    }

    private get resolvedLocale(): string {
        return this.locale || document.documentElement.lang || 'en';
    }

    private get segments(): Segment[] {
        const parts = toParts(this.value ?? 0, this.units);
        const locale = this.resolvedLocale;
        return this.units.map((unit, index) => {
            const text = this.value === null ? '' : segmentText(parts[unit], index === 0 ? LEADING_WIDTH : SEGMENT_WIDTH);
            return {
                unit,
                value: parts[unit],
                text,
                isLeading: index === 0,
                max: segmentMax(unit, index === 0),
                valueText: new Intl.NumberFormat(locale, { style: 'unit', unit: INTL_UNIT[unit], unitDisplay: 'long' }).format(parts[unit]),
                width: boxWidth(text, index === 0 ? '0' : '00'),
            };
        });
    }

    /** What a screen reader hears for the whole control; zero-valued units are left out, a zero duration reads as zero of the smallest. */
    private spokenValue(segments: Segment[]): string {
        if (this.value === null) return '';
        const nonZero = segments.filter((segment) => segment.value > 0);
        const spoken = nonZero.length > 0 ? nonZero : segments.slice(-1);
        return new Intl.ListFormat(this.resolvedLocale, { style: 'long', type: 'unit' }).format(spoken.map((segment) => segment.valueText));
    }

    protected override render() {
        const segments = this.segments;
        return html`<fieldset
            data-slot="duration-input"
            data-variant=${this.variant}
            aria-label=${this.ariaLabel ?? nothing}
            aria-describedby=${this.valueTextId}
            aria-disabled=${this.isDisabled ? 'true' : nothing}
            @focusin=${this.onFocusin}
            @focusout=${this.onFocusout}
        >
            <span id=${this.valueTextId} hidden>${this.spokenValue(segments)}</span>
            ${repeat(
                segments,
                (segment) => segment.unit,
                (segment, index) => html`<input
                        type="text"
                        inputmode="numeric"
                        autocomplete="off"
                        role="spinbutton"
                        style="width:${segment.width}ch"
                        data-slot="duration-input-segment"
                        data-unit=${segment.unit}
                        .value=${live(segment.text)}
                        ?disabled=${this.isDisabled}
                        aria-label=${segment.unit}
                        aria-valuenow=${segment.value}
                        aria-valuemin="0"
                        aria-valuemax=${segment.max}
                        aria-valuetext=${segment.valueText}
                        placeholder=${segment.isLeading ? '0' : '00'}
                        @input=${(event: Event) => this.onSegmentInput(segment.unit, (event.target as HTMLInputElement).value)}
                        @keydown=${(event: KeyboardEvent) => this.onSegmentKeydown(segment, event)}
                    />${index < segments.length - 1 ? html`<span aria-hidden="true" class="colon">:</span>` : nothing}`,
            )}
        </fieldset>`;
    }

    private readonly onFocusin = (event: FocusEvent) => {
        const from = event.relatedTarget as Node | null;
        // Moving between segments is not entering the control.
        if (!from || !this.shadowRoot?.contains(from)) this.valueAtFocus = this.value;
    };

    private readonly onFocusout = (event: FocusEvent) => {
        const next = event.relatedTarget as Node | null;
        if (next && this.shadowRoot?.contains(next)) return;
        if (this.value !== this.valueAtFocus) this.dispatchEvent(new Event('change', { bubbles: true }));
    };

    /** Digits typed into one segment; anything else is ignored. The native input event already reaches the host. */
    private onSegmentInput(unit: DurationUnit, raw: string): void {
        const digits = raw.replaceAll(/\D/g, '');
        this.setSegment(unit, digits === '' ? 0 : Number.parseInt(digits, 10));
    }

    private onSegmentKeydown(segment: Segment, event: KeyboardEvent): void {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        const step = event.key === 'ArrowUp' ? 1 : -1;
        event.preventDefault();
        const next = segment.value + step;
        const size = segment.max + 1;
        // The leading segment is unbounded, so it just goes on (`setSegment` stops it at zero); a bounded one wraps (59 up reads 0).
        const wrapped = segment.isLeading ? next : ((next % size) + size) % size;
        this.setSegment(segment.unit, wrapped);
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }

    private setSegment(unit: DurationUnit, next: number): void {
        const parts = toParts(this.value ?? 0, this.units);
        const updated: DurationParts = { ...parts, [unit]: Math.max(0, next) };
        this.value = fromParts(updated);
    }
}
