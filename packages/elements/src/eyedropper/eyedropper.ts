import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { formatHex, type RGBA } from '../shared/color.js';
import { registerLayer } from '../shared/overlay.js';
import { onPointerDrag } from '../shared/touch.js';
import css from './eyedropper.css?inline';
import { resolveEyedropperLocale, type EyedropperLocale } from './eyedropper.locales.js';

export type EyedropperVariant = 'icon' | 'button';
export type EyedropperFallbackTarget = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

interface NativeEyeDropper {
    open(): Promise<{ sRGBHex: string }>;
}
type NativeEyeDropperConstructor = new () => NativeEyeDropper;

/**
 * A button that picks a colour from the screen. It uses the browser's `EyeDropper` where there is one (Chromium)
 * and otherwise samples a `fallbackTarget` image, canvas or video on the page. With neither, the button is
 * disabled with an explanatory tooltip.
 *
 * @attr {'icon' | 'button'} variant - A square icon button, or a wider one that also shows the label.
 * @attr {string} label - Button text and `aria-label`; defaults to the locale's "Pick color".
 * @attr {boolean} disabled - Blocks picking.
 * @attr {string} locale - Locale id or object; defaults to the page's `lang`, then `en`.
 * @prop {HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | null} fallbackTarget - Element to sample when the native API is missing. Cross-origin images need `crossorigin`.
 * @fires color-pick - A colour was picked; `detail` is the hex string.
 * @fires pick-start - Picking began (the native overlay opened or the crosshair was armed).
 * @fires pick-cancel - Picking ended without a colour: dismissed, Escape, or a click outside the target.
 * @csspart base - The inner `<button>`.
 */
export class GeEyedropper extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static override properties = {
        variant: { reflect: true },
        label: {},
        disabled: { type: Boolean, reflect: true },
        locale: { reflect: true },
        fallbackTarget: { attribute: false },
        picking: { state: true },
    };

    declare variant: EyedropperVariant;
    declare label: string;
    declare disabled: boolean;
    declare locale: string | EyedropperLocale;
    declare fallbackTarget: EyedropperFallbackTarget | null;
    declare picking: boolean;

    constructor() {
        super();
        this.variant = 'icon';
        this.label = '';
        this.disabled = false;
        this.locale = '';
        this.fallbackTarget = null;
        this.picking = false;
    }

    private get t(): EyedropperLocale {
        return resolveEyedropperLocale(this.locale);
    }

    private get hasNativeApi(): boolean {
        return typeof (globalThis as { EyeDropper?: unknown }).EyeDropper === 'function';
    }

    private get isSupported(): boolean {
        return this.hasNativeApi || this.fallbackTarget !== null;
    }

    private get resolvedLabel(): string {
        return this.label || this.t.pickColor;
    }

    protected override render() {
        return html`<button
            part="base"
            type="button"
            data-slot="eyedropper-trigger"
            ?disabled=${this.disabled || !this.isSupported}
            aria-label=${this.resolvedLabel}
            aria-pressed=${String(this.picking)}
            title=${this.isSupported ? this.resolvedLabel : this.t.notSupported}
            dir=${this.t.rtl ? 'rtl' : 'ltr'}
            @click=${this.pick}
        >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m16 3 5 5-2 2-5-5z" />
                <path d="m14 9-9 9v3h3l9-9" />
            </svg>
            ${this.variant === 'button' ? html`<span>${this.resolvedLabel}</span>` : null}
        </button>`;
    }

    /**
     * Starts picking: the native overlay where it exists, otherwise crosshair sampling over `fallbackTarget`.
     * Ignored while disabled, unsupported or already picking.
     */
    async pick(): Promise<void> {
        if (this.disabled || !this.isSupported || this.picking) return;
        if (this.hasNativeApi) {
            await this.pickNative();
            return;
        }
        if (this.fallbackTarget) this.pickFromTarget(this.fallbackTarget);
    }

    private emit(name: string, detail?: string) {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    private async pickNative(): Promise<void> {
        const Native = (globalThis as { EyeDropper?: NativeEyeDropperConstructor }).EyeDropper;
        if (!Native) return;
        this.picking = true;
        this.emit('pick-start');
        try {
            const result = await new Native().open();
            this.emit('color-pick', result.sRGBHex);
        } catch {
            // The native API rejects when the user dismisses its overlay, which is a cancel, not an error.
            this.emit('pick-cancel');
        } finally {
            this.picking = false;
        }
    }

    private pickFromTarget(target: EyedropperFallbackTarget): void {
        const sampling = makeSamplingContext(target);
        if (!sampling) return;
        this.picking = true;
        this.emit('pick-start');
        let release = () => {};
        const finish = (done: () => void) => {
            done();
            this.picking = false;
            release();
        };
        const stop = installSampler(target, sampling, {
            onPick: (rgba) => finish(() => this.emit('color-pick', formatHex(rgba))),
            onCancel: () => finish(() => this.emit('pick-cancel')),
        });
        // A non-modal layer so Escape ends this session and nothing underneath it, even inside a dialog.
        const unregister = registerLayer({ modal: false, dismiss: () => finish(() => this.emit('pick-cancel')) });
        release = () => {
            unregister();
            stop();
        };
    }
}

interface Sampling {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
}

function sourceSize(target: EyedropperFallbackTarget): [number, number] {
    if (target instanceof HTMLImageElement) return [target.naturalWidth, target.naturalHeight];
    if (target instanceof HTMLVideoElement) return [target.videoWidth, target.videoHeight];
    return [target.width, target.height];
}

function makeSamplingContext(target: EyedropperFallbackTarget): Sampling | null {
    const [width, height] = sourceSize(target);
    if (width === 0 || height === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    try {
        ctx.drawImage(target, 0, 0, width, height);
    } catch {
        // A cross-origin image without `crossorigin` cannot be drawn; there is nothing to sample.
        return null;
    }
    return { ctx, width, height };
}

function pointOf(event: Event): { x: number; y: number } | null {
    if ('clientX' in event) return { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
    const touch = (event as TouchEvent).changedTouches?.[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

function installSampler(target: EyedropperFallbackTarget, sampling: Sampling, callbacks: { onPick: (rgba: RGBA) => void; onCancel: () => void }): () => void {
    const originalCursor = target.style.cursor;
    target.style.cursor = 'crosshair';
    let lastSample: RGBA | null = null;

    const sample = (clientX: number, clientY: number): RGBA | null => {
        const rect = target.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        const xRatio = (clientX - rect.left) / rect.width;
        const yRatio = (clientY - rect.top) / rect.height;
        if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) return null;
        const px = Math.min(sampling.width - 1, Math.max(0, Math.floor(xRatio * sampling.width)));
        const py = Math.min(sampling.height - 1, Math.max(0, Math.floor(yRatio * sampling.height)));
        const [r = 0, g = 0, b = 0, a = 255] = sampling.ctx.getImageData(px, py, 1, 1).data;
        return { r, g, b, a: a / 255 };
    };
    const onCommit = (event: Event) => {
        const point = pointOf(event);
        const final = point ? sample(point.x, point.y) : lastSample;
        if (final) callbacks.onPick(final);
        else callbacks.onCancel();
    };

    target.addEventListener('click', onCommit);
    target.addEventListener('touchend', onCommit);
    const stopDrag = onPointerDrag(
        (x, y) => {
            lastSample = sample(x, y) ?? lastSample;
        },
        () => {},
    );
    return () => {
        target.style.cursor = originalCursor;
        target.removeEventListener('click', onCommit);
        target.removeEventListener('touchend', onCommit);
        stopDrag();
    };
}
