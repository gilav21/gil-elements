import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { live } from 'lit/directives/live.js';
import { UiElement } from '@gilav21/elements-base';
import css from './time-picker.css?inline';
import {
    dayPeriodFor,
    displayHour,
    formatTimeValue,
    hoursFromDisplay,
    parseSegmentDigits,
    parseTimeValue,
    segmentBounds,
    segmentDisplay,
    stepSegment,
    timeLayout,
    type DayPeriod,
    type TimeLayout,
    type TimeSegmentKind,
} from './time-picker.format.js';

export type TimePickerVariant = 'outline' | 'underline' | 'ghost';

interface Segment {
    kind: TimeSegmentKind;
    text: string;
    value: number;
    min: number;
    max: number;
    label: string;
}

/** How a segment is named to a screen reader. */
const SEGMENT_LABEL: Record<TimeSegmentKind, string> = { hour: 'hour', minute: 'minute', second: 'second', dayPeriod: 'AM or PM' };

/** Which way an arrow key moves a segment; 0 for a key this control ignores. */
function stepFor(key: string): number {
    if (key === 'ArrowUp') return 1;
    if (key === 'ArrowDown') return -1;
    return 0;
}

/**
 * A time of day, edited one segment at a time.
 *
 * The value is `"HH:mm"` (or `"HH:mm:ss"` with `with-seconds`), always 24-hour, like `<input type="time">`; the
 * empty string means no time. 12-hour is a rendering choice made from the locale, which also decides the segment
 * order (a meridiem first in `zh-TW`), the separators and the digits. An hour without a minute is not a time, so the
 * value stays empty until both are set. The field is pinned left-to-right, also on an RTL page.
 *
 * Arrow Up and Down step the segment under the caret, wrapping at its bounds; typing keeps the last two digits.
 *
 * @fires value-change - When the value changes through the user; `detail` is the new value (`""` while incomplete).
 * @attr {string} value - The time as `HH:mm`. Setting it renders it without firing `value-change`.
 * @attr {string} locale - BCP-47 tag. Defaults to the page's `lang`, then `en`.
 * @attr {boolean} with-seconds - Adds a seconds segment and widens the value to `HH:mm:ss`.
 * @attr {boolean} disabled - Disables every segment.
 * @attr {'outline' | 'underline' | 'ghost'} variant - Visual style of the wrapper. Defaults to `outline`.
 * @attr {string} name - Field name; with it the value is submitted with the surrounding form.
 * @attr {string} aria-label - Accessible name of the group of segments. Defaults to `Time`.
 */
export class GeTimePicker extends UiElement {
    static readonly formAssociated = true;
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        value: { reflect: true },
        locale: { reflect: true },
        withSeconds: { attribute: 'with-seconds', type: Boolean },
        disabled: { type: Boolean, reflect: true },
        variant: { reflect: true },
        name: { reflect: true },
        fieldsetDisabled: { state: true },
        hours: { state: true },
        minutes: { state: true },
        seconds: { state: true },
        period: { state: true },
    };
    declare value: string;
    declare locale: string;
    declare withSeconds: boolean;
    declare disabled: boolean;
    declare variant: TimePickerVariant;
    declare name: string;
    declare fieldsetDisabled: boolean;
    declare hours: number | null;
    declare minutes: number | null;
    declare seconds: number;
    declare period: DayPeriod;

    private readonly internals?: ElementInternals;
    private defaultValue = '';

    constructor() {
        super();
        this.value = '';
        this.locale = '';
        this.withSeconds = false;
        this.disabled = false;
        this.variant = 'outline';
        this.name = '';
        this.fieldsetDisabled = false;
        this.hours = null;
        this.minutes = null;
        this.seconds = 0;
        this.period = 'am';
        this.internals = this.attachInternals?.();
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    private get resolvedLocale(): string {
        const page = typeof document === 'undefined' ? '' : document.documentElement.lang;
        return this.locale || page || 'en';
    }

    private get layout(): TimeLayout {
        return timeLayout(this.resolvedLocale, this.withSeconds);
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'time-picker';
        this.defaultValue = this.getAttribute('value') ?? '';
    }

    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    formResetCallback(): void {
        this.value = this.defaultValue;
        // The value may not change (a half-typed time is "" too), so show it explicitly.
        this.show(this.defaultValue);
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        // A value the segments already represent is an echo of our own commit: rendering it again would wipe a
        // half-typed segment (an hour alone commits "", which would clear the hour that was just typed).
        if (changed.has('value') && this.value !== this.asValue()) this.show(this.value);
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('value') || changed.has('name') || changed.has('withSeconds')) this.internals?.setFormValue(this.value);
    }

    /** Shows a value in the segments without emitting. */
    private show(value: string): void {
        const parts = parseTimeValue(value);
        if (parts === null) {
            this.hours = null;
            this.minutes = null;
            this.seconds = 0;
            return;
        }
        this.hours = parts.hours;
        this.minutes = parts.minutes;
        this.seconds = parts.seconds;
        this.period = dayPeriodFor(parts.hours);
    }

    /** What the segments add up to, or the empty string while they are incomplete. */
    private asValue(): string {
        if (this.hours === null || this.minutes === null) return '';
        return formatTimeValue({ hours: this.hours, minutes: this.minutes, seconds: this.seconds }, this.withSeconds);
    }

    /** The one path a user-driven change takes. */
    private commit(): void {
        const next = this.asValue();
        if (next === this.value) return;
        this.value = next;
        this.dispatchEvent(new CustomEvent('value-change', { detail: next, bubbles: true, composed: true }));
    }

    private rawOf(kind: TimeSegmentKind): number | null {
        if (kind === 'hour') return this.hours;
        if (kind === 'minute') return this.minutes;
        return this.seconds;
    }

    private describe(kind: TimeSegmentKind, layout: TimeLayout): Segment {
        if (kind === 'dayPeriod') {
            return { kind, text: layout.dayPeriods[this.period], value: this.period === 'am' ? 0 : 1, min: 0, max: 1, label: SEGMENT_LABEL[kind] };
        }
        const bounds = segmentBounds(kind, layout.hour12);
        const raw = this.rawOf(kind);
        const shown = raw === null ? null : kind === 'hour' ? displayHour(raw, layout.hour12) : raw;
        return {
            kind,
            text: shown === null ? '' : segmentDisplay(shown, kind, layout),
            value: shown ?? bounds.min,
            min: bounds.min,
            max: bounds.max,
            label: SEGMENT_LABEL[kind],
        };
    }

    private apply(kind: TimeSegmentKind, shown: number): void {
        if (kind === 'hour') this.hours = hoursFromDisplay(shown, this.period, this.layout.hour12);
        else if (kind === 'minute') this.minutes = shown;
        else this.seconds = shown;
        this.commit();
    }

    private clear(kind: TimeSegmentKind): void {
        if (kind === 'hour') this.hours = null;
        else if (kind === 'minute') this.minutes = null;
        else this.seconds = 0;
        this.commit();
    }

    private togglePeriod(): void {
        this.period = this.period === 'am' ? 'pm' : 'am';
        if (this.hours !== null) this.hours = hoursFromDisplay(displayHour(this.hours, true), this.period, true);
        this.commit();
    }

    /** Digits typed into one segment, read through the locale's own glyphs; a longer run keeps its last two. */
    private onInput(kind: TimeSegmentKind, field: HTMLInputElement): void {
        const layout = this.layout;
        const typed = parseSegmentDigits(field.value, layout.digits);
        if (typed !== null) {
            const bounds = segmentBounds(kind, layout.hour12);
            this.apply(kind, Math.min(Math.max(typed % 100, bounds.min), bounds.max));
        } else if (field.value.trim() === '') {
            this.clear(kind);
        }
        // Otherwise the box holds only characters that are not digits: ignore them rather than wipe a valid segment.
        field.value = this.describe(kind, layout).text;
    }

    private onKeydown(kind: TimeSegmentKind, event: KeyboardEvent): void {
        const step = stepFor(event.key);
        if (step === 0) return;
        event.preventDefault();
        if (kind === 'dayPeriod') {
            this.togglePeriod();
            return;
        }
        const layout = this.layout;
        this.apply(kind, stepSegment(this.describe(kind, layout).value, step, segmentBounds(kind, layout.hour12)));
    }

    private valueText(layout: TimeLayout): string {
        const parts = parseTimeValue(this.value);
        if (parts === null) return '';
        const at = new Date(Date.UTC(1970, 0, 1, parts.hours, parts.minutes, parts.seconds));
        return new Intl.DateTimeFormat(this.resolvedLocale, {
            timeStyle: this.withSeconds ? 'medium' : 'short',
            hourCycle: layout.hour12 ? 'h12' : 'h23',
            timeZone: 'UTC',
        }).format(at);
    }

    private renderSegment(segment: Segment, separator: string) {
        const control =
            segment.kind === 'dayPeriod'
                ? html`<button
                      type="button"
                      data-slot="time-picker-period"
                      ?disabled=${this.isDisabled}
                      aria-label=${segment.label}
                      @click=${() => this.togglePeriod()}
                      @keydown=${(e: KeyboardEvent) => this.onKeydown(segment.kind, e)}
                  >
                      ${segment.text}
                  </button>`
                : html`<input
                      type="text"
                      inputmode="numeric"
                      autocomplete="off"
                      role="spinbutton"
                      data-slot="time-picker-segment"
                      data-segment=${segment.kind}
                      .value=${live(segment.text)}
                      ?disabled=${this.isDisabled}
                      aria-label=${segment.label}
                      aria-valuenow=${segment.value}
                      aria-valuemin=${segment.min}
                      aria-valuemax=${segment.max}
                      aria-valuetext="${segment.text} ${segment.label}"
                      placeholder="--"
                      @input=${(e: Event) => this.onInput(segment.kind, e.target as HTMLInputElement)}
                      @keydown=${(e: KeyboardEvent) => this.onKeydown(segment.kind, e)}
                  />`;
        return html`${control}${separator ? html`<span class="separator" aria-hidden="true">${separator}</span>` : nothing}`;
    }

    protected override render() {
        const layout = this.layout;
        return html`<fieldset
            dir="ltr"
            data-variant=${this.variant}
            data-locale=${this.resolvedLocale}
            aria-label=${this.ariaLabel ?? 'Time'}
            aria-describedby="value-text"
            aria-disabled=${this.isDisabled ? 'true' : nothing}
        >
            <span id="value-text" hidden>${this.valueText(layout)}</span>
            ${layout.order.map((kind, index) => this.renderSegment(this.describe(kind, layout), layout.separators[index] ?? ''))}
        </fieldset>`;
    }
}
