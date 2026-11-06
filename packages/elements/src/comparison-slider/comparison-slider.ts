import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { resolveCommonLocale, type CommonLocale } from '../shared/common-locales.js';
import { onPointerDrag } from '../shared/touch.js';
import css from './comparison-slider.css?inline';

export type ComparisonSliderOrientation = 'horizontal' | 'vertical';

const clamp = (n: number): number => Math.max(0, Math.min(100, n));
const chevron = (path: string) =>
    html`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${path} /></svg>`;

/**
 * Two images stacked in one box with a draggable divider: the `before` image shows on the start side, the `after` image is
 * revealed as the divider moves. Drag anywhere on the box, tap to jump, or use the arrow keys, Home and End on the focused
 * handle. The box is 16:9 and fills its width by default; set `aspect-ratio` (or a height) on the host to match your images,
 * which should share dimensions so they line up under the reveal.
 *
 * @fires position-change - The user moved the divider. `detail` is the new position, 0 to 100.
 * @attr {string} before-src - Image on the start side of the divider.
 * @attr {string} after-src - Image underneath, revealed as the divider moves.
 * @attr {string} before-alt - Alt text of the before image.
 * @attr {string} after-alt - Alt text of the after image.
 * @attr {string} before-label - Caption badge in the top-start corner; omitted when unset.
 * @attr {string} after-label - Caption badge in the top-end corner; omitted when unset.
 * @attr {number} position - Divider position as a percentage from the start edge (left, or top when vertical), default 50. Shown clamped to 0-100.
 * @attr {'horizontal' | 'vertical'} orientation - Wipe left-to-right or top-to-bottom (default `horizontal`). Up and Down swap meaning between the two.
 * @attr {string} locale - Locale id for the handle's accessible name; follows the page's `lang` when unset.
 */
export class GeComparisonSlider extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        beforeSrc: { attribute: 'before-src' },
        afterSrc: { attribute: 'after-src' },
        beforeAlt: { attribute: 'before-alt' },
        afterAlt: { attribute: 'after-alt' },
        beforeLabel: { attribute: 'before-label' },
        afterLabel: { attribute: 'after-label' },
        position: { type: Number },
        orientation: { reflect: true },
        locale: {},
        rootWidth: { state: true },
        rootHeight: { state: true },
    };

    declare beforeSrc: string;
    declare afterSrc: string;
    declare beforeAlt: string;
    declare afterAlt: string;
    declare beforeLabel: string | undefined;
    declare afterLabel: string | undefined;
    declare position: number;
    declare orientation: ComparisonSliderOrientation;
    declare locale: string | CommonLocale;
    declare protected rootWidth: number;
    declare protected rootHeight: number;
    private dragCleanup: (() => void) | null = null;
    private resizeObserver: ResizeObserver | null = null;

    constructor() {
        super();
        this.beforeSrc = '';
        this.afterSrc = '';
        this.beforeAlt = '';
        this.afterAlt = '';
        this.position = 50;
        this.orientation = 'horizontal';
        this.locale = '';
        this.rootWidth = 0;
        this.rootHeight = 0;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'comparison-slider';
        this.addEventListener('mousedown', this.onMouseDown);
        this.addEventListener('touchstart', this.onTouchStart, { passive: false });
        if (this.hasUpdated) this.observe();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('mousedown', this.onMouseDown);
        this.removeEventListener('touchstart', this.onTouchStart);
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.dragCleanup?.();
        this.dragCleanup = null;
    }

    protected override firstUpdated(): void {
        this.observe();
    }

    private observe(): void {
        this.measure();
        if (typeof ResizeObserver !== 'function') return;
        this.resizeObserver = new ResizeObserver(() => this.measure());
        this.resizeObserver.observe(this);
    }

    private measure(): void {
        this.rootWidth = this.clientWidth;
        this.rootHeight = this.clientHeight;
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('orientation')) this.measure();
    }

    private get horizontal(): boolean {
        return this.orientation !== 'vertical';
    }

    private move(position: number): void {
        const next = clamp(position);
        this.position = next;
        this.dispatchEvent(new CustomEvent('position-change', { detail: next, bubbles: true, composed: true }));
    }

    private positionFromPointer(clientX: number, clientY: number): number {
        const rect = this.getBoundingClientRect();
        return this.horizontal ? ((clientX - rect.left) / rect.width) * 100 : ((clientY - rect.top) / rect.height) * 100;
    }

    private startDrag(clientX: number, clientY: number): void {
        this.dragCleanup?.();
        this.move(this.positionFromPointer(clientX, clientY));
        this.dragCleanup = onPointerDrag(
            (x, y) => this.move(this.positionFromPointer(x, y)),
            () => {
                this.dragCleanup = null;
            },
        );
    }

    private readonly onMouseDown = (event: MouseEvent): void => {
        this.startDrag(event.clientX, event.clientY);
    };

    private readonly onTouchStart = (event: TouchEvent): void => {
        const touch = event.touches[0];
        if (!touch) return;
        event.preventDefault();
        this.startDrag(touch.clientX, touch.clientY);
    };

    private keyDelta(key: string): number | undefined {
        switch (key) {
            case 'ArrowLeft':
                return -1;
            case 'ArrowRight':
                return 1;
            case 'ArrowUp':
                return this.horizontal ? 1 : -1;
            case 'ArrowDown':
                return this.horizontal ? -1 : 1;
            default:
                return undefined;
        }
    }

    private onKeydown(event: KeyboardEvent): void {
        const delta = this.keyDelta(event.key);
        if (delta !== undefined) {
            event.preventDefault();
            this.move(this.position + delta);
        } else if (event.key === 'Home') {
            event.preventDefault();
            this.move(0);
        } else if (event.key === 'End') {
            event.preventDefault();
            this.move(100);
        }
    }

    protected override render() {
        const horizontal = this.horizontal;
        const locale = resolveCommonLocale(this.locale);
        const position = clamp(Number.isFinite(this.position) ? this.position : 50);
        const clipStyle = horizontal ? `width:${position}%` : `height:${position}%`;
        const innerStyle = horizontal ? `width:${this.rootWidth}px` : `height:${this.rootHeight}px`;
        const dividerStyle = horizontal ? `left:${position}%` : `top:${position}%`;
        return html`<div class="root" dir=${locale.rtl ? 'rtl' : 'ltr'} data-orientation=${this.orientation}>
            <img class="after" src=${this.afterSrc} alt=${this.afterAlt} draggable="false" />
            <div class="clip" part="clip" style=${clipStyle}>
                <div class="inner" style=${innerStyle}>
                    <img class="before" src=${this.beforeSrc} alt=${this.beforeAlt} draggable="false" />
                </div>
            </div>
            <div class="divider" part="divider" style=${dividerStyle}>
                <div class="line"></div>
                <input
                    class="range"
                    type="range"
                    min="0"
                    max="100"
                    .value=${String(position)}
                    aria-label=${locale.comparisonSlider}
                    aria-valuetext="${Math.round(position)}% before, ${Math.round(100 - position)}% after"
                    aria-orientation=${this.orientation}
                    @keydown=${this.onKeydown}
                />
                <div class="handle" part="handle" aria-hidden="true">
                    ${horizontal ? html`${chevron('m15 18-6-6 6-6')}${chevron('m9 18 6-6-6-6')}` : html`${chevron('m18 15-6-6-6 6')}${chevron('m6 9 6 6 6-6')}`}
                </div>
                <div class="line"></div>
            </div>
            ${this.beforeLabel ? html`<span class="label start">${this.beforeLabel}</span>` : nothing}
            ${this.afterLabel ? html`<span class="label end">${this.afterLabel}</span>` : nothing}
        </div>`;
    }
}
