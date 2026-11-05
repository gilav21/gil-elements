import { html, nothing, svg, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import {
    contrastRatio,
    formatHex,
    formatHsl,
    formatOklch,
    formatRgb,
    harmonyAnalogous,
    harmonyComplementary,
    harmonyTetradic,
    harmonyTriadic,
    hslToRgb,
    hsvToRgb,
    parseColor,
    rgbToHsl,
    rgbToHsv,
    type RGBA,
} from '../shared/color.js';
import { extractDominantColors, type ExtractAlgorithm } from '../shared/color-extract.js';
import { attachHint } from '../shared/hint.js';
import { onPointerDrag } from '../shared/touch.js';
import css from './color-picker.css?inline';
import { resolveColorPickerLocale, type ColorPickerLocale } from './color-picker.locales.js';
import { keyboardStep, paletteToHex, readRecents, unshiftUniqueColor, wcagBadge, writeRecents } from './color-picker.utils.js';

export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';
export type ColorPickerFallbackTarget = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

interface HarmonyGroup {
    readonly label: string;
    readonly hint: string;
    readonly swatches: readonly string[];
}

const DEFAULT_RGBA: RGBA = { r: 0, g: 0, b: 0, a: 1 };
const COPIED_MS = 1500;
const FORMATS: readonly ColorFormat[] = ['hex', 'rgb', 'hsl', 'oklch'];

const ICON = (paths: TemplateResult) =>
    svg`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const COPY = ICON(svg`<rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />`);
const CHECK = ICON(svg`<path d="m4 12.5 5 5L20 6.5" />`);
const CHEVRON = ICON(svg`<path d="m5 9 7 7 7-7" />`);
const PIPETTE_IMAGE = ICON(svg`<rect width="13" height="13" x="2" y="9" rx="2" /><circle cx="6" cy="13" r="1.5" /><path d="m2 19 4-4 3 3 3-3 3 3" /><g transform="translate(11 1) scale(0.5)" stroke-width="3.2"><path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" /></g>`);

const defaultTrue = { fromAttribute: (value: string | null) => value !== 'false', toAttribute: (value: boolean) => (value ? null : 'false') };
const jsonList = {
    fromAttribute(value: string | null): string[] {
        try {
            const parsed: unknown = JSON.parse(value ?? '[]');
            return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : [];
        } catch {
            return [];
        }
    },
};
const formatList = {
    fromAttribute: (value: string | null): ColorFormat[] => (value ?? '').split(/[\s,]+/).filter((f): f is ColorFormat => (FORMATS as readonly string[]).includes(f)),
};

let nextId = 0;

/**
 * A colour picker: a saturation and value area, a hue slider, an optional alpha slider, swatches, and a tab per
 * colour format. By default a button shows the colour and opens the panel in a popover; `inline` renders the panel
 * on its own. Everything it emits is hex, whatever format is being edited.
 *
 * It is form-associated: with a `name` it submits the hex value. A colour set from outside (the `value` attribute
 * or property) is applied silently; only the user's own picks fire `color-change`.
 *
 * @slot trigger - A custom trigger in place of the default button.
 * @attr {string} value - The colour, as any CSS colour; read back as hex.
 * @attr {string} name - Field name for form submission.
 * @attr {boolean} inline - Render just the panel, without the button and popover.
 * @attr {boolean} disabled - Disables every control.
 * @attr {boolean} alpha - Show the alpha slider and emit 8-digit hex while a < 1.
 * @attr {string} formats - Space-separated format tabs, in order: `hex rgb hsl oklch`. The first is shown first.
 * @attr {boolean} show-recent - The recently-used row; `show-recent="false"` hides it.
 * @attr {number} max-recent - How many recents to keep. Defaults to 8.
 * @attr {string} storage-key - `localStorage` key that keeps recents across reloads.
 * @attr {boolean} enable-eyedropper - The screen eyedropper; `enable-eyedropper="false"` hides it.
 * @attr {boolean} enable-image-pick - A button that extracts a palette from an image file.
 * @attr {'median-cut' | 'k-means'} image-extract-algorithm - How the palette is quantised. Defaults to `median-cut`.
 * @attr {number} image-extract-count - How many colours to extract. Defaults to 6.
 * @attr {boolean} show-harmonies - Readable, opposite, neighbour, trio and quartet swatches for the colour.
 * @attr {boolean} show-contrast - A WCAG contrast badge between the colour and `contrast-background`.
 * @attr {string} contrast-background - The colour compared against. Defaults to white.
 * @attr {string} locale - Locale id; defaults to the page's `lang`, then `en`.
 * @prop {string[]} presets - Swatches in the preset row (a JSON array in the `presets` attribute).
 * @prop {string[] | null} recentColors - Controlled recents; while set, the picker only emits `recent-colors-change`.
 * @prop {HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | null} fallbackTarget - What the eyedropper samples without a native picker.
 * @fires color-change - After the user changes the colour; `detail` is the hex string.
 * @fires recent-colors-change - The next recents list, only while `recentColors` is controlled.
 * @csspart trigger - The default trigger button.
 * @cssprop --density-picker - Spacing multiplier for the trigger; falls back to `--density`.
 */
export class GeColorPicker extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static formAssociated = true;
    static override properties = {
        value: { reflect: false },
        name: { reflect: true },
        presets: { converter: jsonList },
        inline: { type: Boolean, reflect: true },
        disabled: { type: Boolean, reflect: true },
        alpha: { type: Boolean, reflect: true },
        recentColors: { attribute: false },
        showRecent: { attribute: 'show-recent', converter: defaultTrue },
        maxRecent: { type: Number, attribute: 'max-recent' },
        storageKey: { attribute: 'storage-key' },
        enableEyedropper: { attribute: 'enable-eyedropper', converter: defaultTrue },
        fallbackTarget: { attribute: false },
        enableImagePick: { type: Boolean, attribute: 'enable-image-pick' },
        imageExtractAlgorithm: { attribute: 'image-extract-algorithm' },
        imageExtractCount: { type: Number, attribute: 'image-extract-count' },
        showHarmonies: { type: Boolean, attribute: 'show-harmonies' },
        showContrast: { type: Boolean, attribute: 'show-contrast' },
        contrastBackground: { attribute: 'contrast-background' },
        formats: { converter: formatList },
        locale: {},
        isOpen: { state: true },
        fieldsetDisabled: { state: true },
        rgba: { state: true },
        hue: { state: true },
        saturation: { state: true },
        hsvValue: { state: true },
        extractedPalette: { state: true },
        internalRecents: { state: true },
        copiedFormat: { state: true },
        copiedHarmony: { state: true },
        compareA: { state: true },
        compareB: { state: true },
        compareActive: { state: true },
        activeFormat: { state: true },
    };

    declare value: string;
    declare name: string;
    declare presets: string[];
    declare inline: boolean;
    declare disabled: boolean;
    declare alpha: boolean;
    declare recentColors: string[] | null;
    declare showRecent: boolean;
    declare maxRecent: number;
    declare storageKey: string;
    declare enableEyedropper: boolean;
    declare fallbackTarget: ColorPickerFallbackTarget | null;
    declare enableImagePick: boolean;
    declare imageExtractAlgorithm: ExtractAlgorithm;
    declare imageExtractCount: number;
    declare showHarmonies: boolean;
    declare showContrast: boolean;
    declare contrastBackground: string;
    declare formats: ColorFormat[];
    declare locale: string | ColorPickerLocale;
    declare isOpen: boolean;
    declare fieldsetDisabled: boolean;
    declare rgba: RGBA;
    declare hue: number;
    declare saturation: number;
    declare hsvValue: number;
    declare extractedPalette: string[];
    declare internalRecents: string[];
    declare copiedFormat: ColorFormat | null;
    declare copiedHarmony: string | null;
    declare compareA: RGBA;
    declare compareB: RGBA;
    declare compareActive: 'a' | 'b';
    declare activeFormat: ColorFormat | '';

    private readonly internals?: ElementInternals;
    private readonly id0 = `ge-color-picker-${++nextId}`;
    private dragCleanup: (() => void) | null = null;
    private copyTimer: ReturnType<typeof setTimeout> | null = null;
    private harmonyTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly hints = new WeakMap<Element, () => void>();
    private readonly releaseHints = new Set<() => void>();
    private defaultValue: string | undefined;

    constructor() {
        super();
        this.value = '';
        this.name = '';
        this.presets = [];
        this.inline = false;
        this.disabled = false;
        this.alpha = false;
        this.recentColors = null;
        this.showRecent = true;
        this.maxRecent = 8;
        this.storageKey = '';
        this.enableEyedropper = true;
        this.fallbackTarget = null;
        this.enableImagePick = false;
        this.imageExtractAlgorithm = 'median-cut';
        this.imageExtractCount = 6;
        this.showHarmonies = false;
        this.showContrast = false;
        this.contrastBackground = '#ffffff';
        this.formats = ['hex', 'rgb', 'hsl'];
        this.locale = '';
        this.isOpen = false;
        this.fieldsetDisabled = false;
        this.rgba = DEFAULT_RGBA;
        this.hue = 0;
        this.saturation = 0;
        this.hsvValue = 0;
        this.extractedPalette = [];
        this.internalRecents = [];
        this.copiedFormat = null;
        this.copiedHarmony = null;
        this.compareA = DEFAULT_RGBA;
        this.compareB = { r: 255, g: 255, b: 255, a: 1 };
        this.compareActive = 'a';
        this.activeFormat = '';
        this.internals = this.attachInternals?.();
    }

    private get t(): ColorPickerLocale {
        return resolveColorPickerLocale(this.locale);
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    /** The colour as hex: 8 digits when `alpha` is on and a < 1. A fully transparent colour keeps its alpha even with `alpha` off, so `transparent` never becomes opaque black. */
    get currentColor(): string {
        return formatHex(this.rgba, this.alpha || this.rgba.a === 0);
    }

    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    formResetCallback(): void {
        const parsed = this.defaultValue ? parseColor(this.defaultValue) : null;
        this.applyRgba(parsed ?? DEFAULT_RGBA);
    }

    /** Opens the popover; does nothing while disabled or inline. */
    show(): void {
        if (!this.isDisabled && !this.inline) this.isOpen = true;
    }

    /** Closes the popover. */
    hide(): void {
        this.isOpen = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'color-picker';
        this.defaultValue ??= this.value;
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.dragCleanup?.();
        this.dragCleanup = null;
        if (this.copyTimer) clearTimeout(this.copyTimer);
        if (this.harmonyTimer) clearTimeout(this.harmonyTimer);
        for (const release of this.releaseHints) release();
        this.releaseHints.clear();
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('disabled') && this.isDisabled) this.isOpen = false;
        if (changed.has('value') && this.value) {
            const parsed = parseColor(this.value);
            if (parsed && formatHex(parsed, this.alpha || parsed.a === 0) !== this.currentColor) this.applyRgba(parsed);
        }
        // `value` always reads back as the hex the picker holds, whatever CSS colour was written.
        if (this.value !== this.currentColor) this.value = this.currentColor;
        if (changed.has('contrastBackground')) {
            const parsed = parseColor(this.contrastBackground);
            if (parsed) this.compareB = parsed;
        }
        if (changed.has('storageKey') && this.storageKey) {
            const loaded = readRecents(this.storageKey, this.maxRecent);
            if (loaded.length > 0) this.internalRecents = loaded;
        }
        if (!this.activeFormat || !this.formats.includes(this.activeFormat)) this.activeFormat = this.formats[0] ?? '';
    }

    protected override updated(): void {
        this.internals?.setFormValue(this.currentColor);
        for (const target of this.renderRoot.querySelectorAll<HTMLElement>('[data-hint]')) {
            if (this.hints.has(target)) continue;
            const release = attachHint(target, { text: () => target.dataset.hint ?? '', side: () => 'top', disabled: () => false });
            this.hints.set(target, release);
            this.releaseHints.add(release);
        }
    }

    // Colour state --------------------------------------------------------------------------------------------

    /** Sets the colour and re-derives the HSV view state, keeping the hue on greys where HSV hue is undefined. */
    applyRgba(rgba: RGBA): void {
        this.rgba = rgba;
        const hsv = rgbToHsv(rgba);
        if (hsv.s > 0) this.hue = hsv.h;
        this.saturation = hsv.s;
        this.hsvValue = hsv.v;
        this.syncCompare(rgba);
    }

    private syncCompare(rgba: RGBA): void {
        if (this.compareActive === 'a') this.compareA = rgba;
        else this.compareB = rgba;
    }

    /** Applies a colour the user chose and announces it when the hex changed. */
    private commit(rgba: RGBA): void {
        const before = this.currentColor;
        this.applyRgba(rgba);
        this.announce(before);
    }

    private commitHsv(): void {
        const before = this.currentColor;
        const rgb = hsvToRgb({ h: this.hue, s: this.saturation, v: this.hsvValue });
        this.rgba = { ...rgb, a: this.rgba.a };
        this.syncCompare(this.rgba);
        this.announce(before);
    }

    private announce(before: string): void {
        const now = this.currentColor;
        if (now === before) return;
        this.value = now;
        this.dispatchEvent(new CustomEvent('color-change', { detail: now, bubbles: true, composed: true }));
    }

    private setAlpha(a: number): void {
        const before = this.currentColor;
        this.rgba = { ...this.rgba, a: Math.max(0, Math.min(1, a)) };
        this.syncCompare(this.rgba);
        this.announce(before);
    }

    private selectPreset(color: string): void {
        const parsed = parseColor(color);
        if (!parsed) return;
        this.commit(parsed);
        this.pushRecent(this.currentColor);
    }

    private pushRecent(color: string): void {
        if (!this.showRecent) return;
        if (this.recentColors !== null) {
            const next = unshiftUniqueColor(this.recentColors, color, this.maxRecent);
            this.dispatchEvent(new CustomEvent('recent-colors-change', { detail: next, bubbles: true, composed: true }));
            return;
        }
        this.internalRecents = unshiftUniqueColor(this.internalRecents, color, this.maxRecent);
        if (this.storageKey) writeRecents(this.storageKey, this.internalRecents);
    }

    private get recents(): string[] {
        return this.recentColors ?? this.internalRecents;
    }

    /** Chooses which side of the contrast pair the picker edits, and loads that slot's colour. */
    setCompareSlot(slot: 'a' | 'b'): void {
        this.compareActive = slot;
        this.commit(slot === 'a' ? this.compareA : this.compareB);
    }

    // Area, sliders and fields --------------------------------------------------------------------------------

    private readonly onAreaDown = (event: MouseEvent | TouchEvent) => {
        if (this.isDisabled) return;
        const point = 'touches' in event ? event.touches[0] : event;
        if (!point) return;
        event.preventDefault();
        this.updateFromArea(point.clientX, point.clientY);
        this.dragCleanup = onPointerDrag(
            (x, y) => this.updateFromArea(x, y),
            () => {
                this.dragCleanup = null;
            },
        );
    };

    private updateFromArea(clientX: number, clientY: number): void {
        const area = this.renderRoot.querySelector<HTMLElement>('.area');
        if (!area) return;
        const rect = area.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        this.saturation = Math.round(x * 100);
        this.hsvValue = Math.round((1 - y) * 100);
        this.commitHsv();
    }

    private readonly onAreaKey = (event: KeyboardEvent) => {
        if (this.isDisabled) return;
        const step = keyboardStep(event);
        if (!step) return;
        event.preventDefault();
        this.saturation = Math.max(0, Math.min(100, this.saturation + step.dSaturation));
        this.hsvValue = Math.max(0, Math.min(100, this.hsvValue + step.dValue));
        this.commitHsv();
    };

    private readonly onHue = (event: Event) => {
        this.hue = Number((event.target as HTMLInputElement).value);
        this.commitHsv();
    };

    private readonly onAlpha = (event: Event) => {
        this.setAlpha(Number((event.target as HTMLInputElement).value) / 100);
    };

    private onHexInput(event: Event): void {
        const parsed = parseColor((event.target as HTMLInputElement).value);
        if (parsed) this.commit(parsed);
    }

    private onRgbInput(channel: 'r' | 'g' | 'b', event: Event): void {
        const value = Number((event.target as HTMLInputElement).value);
        const { r, g, b } = this.rgba;
        this.commit({ r, g, b, a: this.rgba.a, [channel]: Math.max(0, Math.min(255, value)) });
    }

    private onHslInput(channel: 'h' | 's' | 'l', event: Event): void {
        const value = Number((event.target as HTMLInputElement).value);
        const next = { ...rgbToHsl(this.rgba), [channel]: Math.max(0, Math.min(channel === 'h' ? 360 : 100, value)) };
        this.commit({ ...hslToRgb(next), a: this.rgba.a });
    }

    // Image, eyedropper, clipboard ----------------------------------------------------------------------------

    private readonly onEyedropperPick = (event: Event) => {
        event.stopPropagation();
        this.selectPreset((event as CustomEvent<string>).detail);
    };

    private async onImageSelected(event: Event): Promise<void> {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        try {
            const palette = await extractDominantColors(file, { count: this.imageExtractCount, algorithm: this.imageExtractAlgorithm });
            this.extractedPalette = paletteToHex(palette, this.alpha);
            const first = this.extractedPalette[0];
            if (first) this.selectPreset(first);
        } catch {
            this.extractedPalette = [];
        } finally {
            target.value = '';
        }
    }

    private async copy(format: ColorFormat): Promise<void> {
        try {
            await navigator.clipboard.writeText(this.formatValues()[format]);
            this.copiedFormat = format;
            if (this.copyTimer) clearTimeout(this.copyTimer);
            this.copyTimer = setTimeout(() => (this.copiedFormat = null), COPIED_MS);
        } catch {
            // Without clipboard permission nothing is copied; the missing check mark is the only signal.
        }
    }

    private async copyHarmony(hex: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(hex);
            this.copiedHarmony = hex;
            if (this.harmonyTimer) clearTimeout(this.harmonyTimer);
            this.harmonyTimer = setTimeout(() => (this.copiedHarmony = null), COPIED_MS);
        } catch {
            // As for `copy`.
        }
    }

    private formatValues(): Record<ColorFormat, string> {
        return { hex: this.currentColor, rgb: formatRgb(this.rgba), hsl: formatHsl(this.rgba), oklch: formatOklch(this.rgba) };
    }

    private harmonyGroups(): readonly HarmonyGroup[] {
        const c = this.rgba;
        const hex = (palette: RGBA[]) => palette.map((p) => formatHex(p, this.alpha));
        const rgb = { r: c.r, g: c.g, b: c.b };
        const readable = contrastRatio(rgb, { r: 0, g: 0, b: 0 }) >= contrastRatio(rgb, { r: 255, g: 255, b: 255 }) ? ['#000000', '#ffffff'] : ['#ffffff', '#000000'];
        return [
            { label: 'Readable', hint: 'Best color for TEXT on this background. Black or white, whichever has higher WCAG contrast. Use this for labels, body text, or icons that must stay legible.', swatches: readable },
            { label: 'Opposite', hint: 'Opposite on the color wheel — vibrant visual pop. Use for accents that should grab the eye (buttons, badges, highlights). NOT a readable text color: complementary pairs often have similar brightness, so contrast for text can be poor. Use "Readable" above for text.', swatches: hex(harmonyComplementary(c)) },
            { label: 'Neighbors', hint: 'Sit right next to this color on the wheel — calm and harmonious. Great for backgrounds, gradients, and sections that should feel related.', swatches: hex(harmonyAnalogous(c)) },
            { label: 'Trio', hint: 'Three evenly-spaced colors — balanced and lively without clashing. Use one as the main color and the others as accents.', swatches: hex(harmonyTriadic(c)) },
            { label: 'Quartet', hint: 'Two pairs of opposites — a rich, bold four-color palette. Pick one as the dominant color, the rest as supporting accents.', swatches: hex(harmonyTetradic(c)) },
        ];
    }

    // Rendering -----------------------------------------------------------------------------------------------

    private toolbar(): TemplateResult | typeof nothing {
        if (!this.enableEyedropper && !this.enableImagePick) return nothing;
        return html`<div class="toolbar">
            ${this.enableEyedropper
                ? html`<ge-eyedropper variant="icon" .locale=${this.locale} .fallbackTarget=${this.fallbackTarget} data-hint="Pick color from screen" @color-pick=${this.onEyedropperPick}></ge-eyedropper>`
                : nothing}
            ${this.enableImagePick
                ? html`<button type="button" class="tool" data-slot="image-pick-trigger" data-hint="Pick color from image" aria-label=${this.t.pickColorFromImage} @click=${() => this.renderRoot.querySelector<HTMLInputElement>('.file')?.click()}>${PIPETTE_IMAGE}</button>
                    <input class="file" type="file" accept="image/*" hidden @change=${this.onImageSelected} />`
                : nothing}
        </div>`;
    }

    private swatchList(label: string, colors: readonly string[], onPick: (color: string) => void, checker = false, ariaPrefix = 'Select ') {
        return html`<ul class="swatches" aria-label=${label}>
            ${colors.map((color) => html`<li><button type="button" class="swatch ${checker ? 'checker' : ''}" style="background-color:${color}" aria-label="${ariaPrefix}${color}" @click=${() => onPick(color)}></button></li>`)}
        </ul>`;
    }

    private recentsRow() {
        if (!this.showRecent || this.recents.length === 0) return nothing;
        return html`<fieldset>
            <legend>${this.t.recent}</legend>
            ${this.swatchList(this.t.recentColors, this.recents, (c) => this.selectPreset(c), true, 'Apply recent ')}
        </fieldset>`;
    }

    private extractedRow() {
        if (this.extractedPalette.length === 0) return nothing;
        return html`<fieldset>
            <div class="legend-row"><legend>From image</legend><button type="button" class="clear" @click=${() => (this.extractedPalette = [])}>Clear</button></div>
            ${this.swatchList(this.t.extractedPalette, this.extractedPalette, (c) => this.selectPreset(c), false, 'Apply extracted ')}
        </fieldset>`;
    }

    private presetsRow() {
        if (this.presets.length === 0) return nothing;
        return html`<fieldset>
            <legend>Presets</legend>
            <div class="swatches">
                ${this.presets.map((color) => html`<button type="button" data-color-btn class="swatch ${this.currentColor === color ? 'selected' : ''}" style="background-color:${color}" aria-label="Select ${color}" @click=${() => this.selectPreset(color)}></button>`)}
            </div>
        </fieldset>`;
    }

    private harmoniesRow() {
        if (!this.showHarmonies) return nothing;
        return html`<fieldset>
            <legend>Harmonies</legend>
            <div class="harmonies">
                ${this.harmonyGroups().map(
                    (group) => html`<div class="harmony">
                        <span class="harmony-label" data-hint=${group.hint}>${group.label}</span>
                        <div class="harmony-swatches">
                            ${group.swatches.map(
                                (color) => html`<button type="button" class="harmony-swatch" style="background-color:${color}" data-hint=${this.copiedHarmony === color ? `Copied ${color}` : `Click to copy ${color}`} aria-label="Copy ${color}" @click=${() => this.copyHarmony(color)}>
                                    ${this.copiedHarmony === color ? html`<span class="copied-mark">${CHECK}</span>` : nothing}
                                </button>`,
                            )}
                            ${this.copiedHarmony && group.swatches.includes(this.copiedHarmony) ? html`<span class="copied-badge">${CHECK}${this.copiedHarmony}</span>` : nothing}
                        </div>
                    </div>`,
                )}
            </div>
        </fieldset>`;
    }

    private contrastRow() {
        if (!this.showContrast) return nothing;
        const a = this.compareA;
        const b = this.compareB;
        const ratio = contrastRatio({ r: a.r, g: a.g, b: a.b }, { r: b.r, g: b.g, b: b.b });
        const badge = wcagBadge(ratio);
        const slot = (which: 'a' | 'b', color: RGBA, label: string) => {
            const hex = formatHex(color, this.alpha);
            return html`<button type="button" class="slot ${this.compareActive === which ? 'active' : ''}" data-hint="Edit color ${which.toUpperCase()} with the picker above" aria-label="${label} ${hex}" @click=${() => this.setCompareSlot(which)}>
                <span class="slot-swatch" style="background-color:${hex}"></span><span class="slot-hex">${hex}</span>
            </button>`;
        };
        return html`<div class="contrast">
            <div class="contrast-slots">${slot('a', a, this.t.editColorA)}<span class="vs">vs</span>${slot('b', b, this.t.editColorB)}</div>
            <div class="contrast-result"><span class="ratio">${ratio.toFixed(2)}:1</span><span class="badge ${badge.pass ? 'pass' : 'fail'}">${badge.label}</span></div>
        </div>`;
    }

    private copyButton(format: ColorFormat, label: string, size: 'lg' | 'sm') {
        return html`<button type="button" class="copy ${size}" aria-label=${label} @click=${() => this.copy(format)}>${this.copiedFormat === format ? CHECK : COPY}</button>`;
    }

    private channel(letter: string, label: string, value: number, onInput: (event: Event) => void) {
        return html`<div><span class="channel-letter" aria-hidden="true">${letter}</span><ge-input type="number" class="field" aria-label=${label} .value=${String(value)} @input=${onInput}></ge-input></div>`;
    }

    private formatTab(format: ColorFormat) {
        const values = this.formatValues();
        const t = this.t;
        const rgb = this.rgba;
        const hsl = rgbToHsl(rgb);
        switch (format) {
            case 'hex':
                return html`<div class="row">
                    <ge-input type="text" class="field grow mono" placeholder="#000000" .value=${values.hex} @input=${(e: Event) => this.onHexInput(e)}></ge-input>
                    ${this.copyButton('hex', t.copyHex, 'lg')}
                </div>`;
            case 'rgb':
                return html`<div class="stack">
                    <div class="grid3">
                        ${this.channel('R', t.red, rgb.r, (e) => this.onRgbInput('r', e))}${this.channel('G', t.green, rgb.g, (e) => this.onRgbInput('g', e))}${this.channel('B', t.blue, rgb.b, (e) => this.onRgbInput('b', e))}
                    </div>
                    <div class="row"><span class="value">${values.rgb}</span>${this.copyButton('rgb', t.copyRgb, 'sm')}</div>
                </div>`;
            case 'hsl':
                return html`<div class="stack">
                    <div class="grid3">
                        ${this.channel('H', t.hue, hsl.h, (e) => this.onHslInput('h', e))}${this.channel('S', t.saturation, hsl.s, (e) => this.onHslInput('s', e))}${this.channel('L', t.lightness, hsl.l, (e) => this.onHslInput('l', e))}
                    </div>
                    <div class="row"><span class="value">${values.hsl}</span>${this.copyButton('hsl', t.copyHsl, 'sm')}</div>
                </div>`;
            default:
                return html`<div class="row"><span class="value">${values.oklch}</span>${this.copyButton('oklch', t.copyOklch, 'sm')}</div>`;
        }
    }

    private tabs() {
        const formats = this.formats;
        return html`<ge-tabs .value=${this.activeFormat} @tab-change=${(e: CustomEvent<string>) => (this.activeFormat = e.detail as ColorFormat)}>
            <ge-tabs-list class="format-list">${formats.map((f) => html`<ge-tabs-trigger value=${f} class="format-trigger">${f}</ge-tabs-trigger>`)}</ge-tabs-list>
            ${formats.map((f) => html`<ge-tabs-content value=${f} class="format-content">${f === this.activeFormat ? this.formatTab(f) : nothing}</ge-tabs-content>`)}
        </ge-tabs>`;
    }

    private panel() {
        const t = this.t;
        const { r, g, b } = this.rgba;
        const current = this.currentColor;
        const hueId = `${this.id0}-hue`;
        const alphaId = `${this.id0}-alpha`;
        return html`<div class="panel" ?inert=${this.isDisabled}>
            ${this.toolbar()}
            <div class="area" style="background: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${this.hue}, 100%, 50%))"
                tabindex="0" role="slider" aria-label=${t.saturationValue} aria-valuenow=${this.saturation} aria-valuemin="0" aria-valuemax="100"
                aria-valuetext="S ${this.saturation}%, V ${this.hsvValue}%" @mousedown=${this.onAreaDown} @touchstart=${this.onAreaDown} @keydown=${this.onAreaKey}>
                <div class="marker" style="left:${this.saturation}%;top:${100 - this.hsvValue}%;background-color:${current}"></div>
            </div>
            <div class="control">
                <label for=${hueId}>Hue</label>
                <input id=${hueId} class="slider" type="range" min="0" max="360" .value=${String(this.hue)} aria-label=${t.hue} @input=${this.onHue}
                    style="background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)" />
            </div>
            ${this.alpha
                ? html`<div class="control">
                      <label for=${alphaId}>Alpha</label>
                      <div class="alpha-track checker">
                          <input id=${alphaId} class="slider alpha-input" type="range" min="0" max="100" step="1" .value=${String(this.rgba.a * 100)} aria-label=${t.alpha} @input=${this.onAlpha}
                              style="background: linear-gradient(to right, rgba(${r},${g},${b},0), rgba(${r},${g},${b},1))" />
                      </div>
                  </div>`
                : nothing}
            ${this.recentsRow()}${this.extractedRow()}${this.presetsRow()}${this.harmoniesRow()}${this.contrastRow()}
            ${this.tabs()}
        </div>`;
    }

    private trigger() {
        return html`<slot name="trigger"><button type="button" class="trigger" part="trigger" data-slot="color-picker-trigger" ?disabled=${this.isDisabled} aria-expanded=${this.isOpen ? 'true' : 'false'} aria-haspopup="dialog">
            <span class="trigger-swatch checker" style="background-color:${this.currentColor}"></span>
            <span class="trigger-text">${this.currentColor || 'Select color'}</span>${CHEVRON}
        </button></slot>`;
    }

    protected override render() {
        if (this.inline) return this.panel();
        return html`<ge-popover dir=${this.t.rtl ? 'rtl' : 'ltr'} ?open=${this.isOpen} @open-change=${(e: CustomEvent<boolean>) => {
            e.stopPropagation();
            this.isOpen = e.detail;
        }}>
            <ge-popover-trigger>${this.trigger()}</ge-popover-trigger>
            <ge-popover-content strategy="fixed" align="start" no-restore-focus>${this.isOpen ? this.panel() : nothing}</ge-popover-content>
        </ge-popover>`;
    }
}
