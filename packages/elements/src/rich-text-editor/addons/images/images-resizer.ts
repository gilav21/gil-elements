import { html, nothing, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { applyImageAlignment, type ImageAlignment } from './images-utils.js';

/** The five titles of the resize toolbar. */
export interface ImageResizerLabels {
    readonly inline: string;
    readonly floatLeft: string;
    readonly center: string;
    readonly floatRight: string;
    readonly deleteImage: string;
}

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

export interface ImageResizerOptions {
    readonly doc: Document;
    /** The element the image is clipped to and scrolls in; its scroll and size are tracked. */
    readonly container: () => HTMLElement | null;
    /** The positioned element the frame is laid out in; the container when omitted. */
    readonly origin?: () => HTMLElement | null;
    /** The frame moved or the state it draws changed. */
    readonly requestRender: () => void;
    /** A drag or a run of arrow keys finished; the size is already on the image. */
    readonly onResizeEnd: () => void;
    /** An alignment was applied to the image. */
    readonly onAlign: (align: ImageAlignment) => void;
    /** The delete button was pressed; removing the image is the owner's job. */
    readonly onRemove: (image: HTMLImageElement) => void;
}

interface DragState {
    readonly startX: number;
    readonly startY: number;
    readonly startWidth: number;
    readonly startHeight: number;
    readonly handle: ResizeHandle;
}

export interface ImageBox {
    readonly top: number;
    readonly left: number;
    readonly width: number;
    readonly height: number;
}

interface Size {
    readonly width: number;
    readonly height: number;
}

const WIDTH_SIGN: Readonly<Record<ResizeHandle, number>> = { nw: -1, w: -1, sw: -1, ne: 1, e: 1, se: 1, n: 0, s: 0 };
const HEIGHT_SIGN: Readonly<Record<ResizeHandle, number>> = { nw: -1, n: -1, ne: -1, sw: 1, s: 1, se: 1, e: 0, w: 0 };

const CORNERS: readonly ResizeHandle[] = ['nw', 'ne', 'sw', 'se'];
const EDGES: readonly ResizeHandle[] = ['n', 's', 'w', 'e'];
const ALIGNMENTS: readonly ImageAlignment[] = ['inline', 'left', 'center', 'right'];

const RESIZE_HANDLE_LABELS: Readonly<Record<ResizeHandle, string>> = {
    nw: 'Resize from top left',
    ne: 'Resize from top right',
    sw: 'Resize from bottom left',
    se: 'Resize from bottom right',
    n: 'Resize from top',
    s: 'Resize from bottom',
    w: 'Resize from left',
    e: 'Resize from right',
};

const KEYBOARD_STEP = 10;
const KEYBOARD_STEP_LARGE = 50;
const KEYBOARD_COALESCE_MS = 400;
const MAX_IMAGE_DIMENSION = 10000;
const ARROWS: Readonly<Record<string, { x: number; y: number } | undefined>> = {
    ArrowRight: { x: 1, y: 0 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowDown: { x: 0, y: 1 },
    ArrowUp: { x: 0, y: -1 },
};

const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const ALIGNMENT_ICONS: Readonly<Record<ImageAlignment, string>> = {
    inline: `${SVG_OPEN}<path d="M17 6H3"/><path d="M21 12H3"/><path d="M15.5 18H3"/><rect x="15" y="5" width="6" height="4" rx="1" fill="currentColor" opacity="0.3" stroke="none"/></svg>`,
    left: `${SVG_OPEN}<rect x="3" y="3" width="8" height="7" rx="1" fill="currentColor" opacity="0.3" stroke="currentColor"/><path d="M14 5h7"/><path d="M14 9h7"/><path d="M3 14h18"/><path d="M3 18h18"/></svg>`,
    center: `${SVG_OPEN}<rect x="8" y="3" width="8" height="7" rx="1" fill="currentColor" opacity="0.3" stroke="currentColor"/><path d="M3 14h18"/><path d="M3 18h18"/></svg>`,
    right: `${SVG_OPEN}<rect x="13" y="3" width="8" height="7" rx="1" fill="currentColor" opacity="0.3" stroke="currentColor"/><path d="M3 5h7"/><path d="M3 9h7"/><path d="M3 14h18"/><path d="M3 18h18"/></svg>`,
};
const DELETE_ICON = `${SVG_OPEN}<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;

const DEFAULT_LABELS: ImageResizerLabels = { inline: 'Inline', floatLeft: 'Float left', center: 'Center', floatRight: 'Float right', deleteImage: 'Delete image' };

function pointOf(event: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
    if (!('touches' in event)) return event;
    const touch = event.touches[0] ?? event.changedTouches[0];
    return { clientX: touch?.clientX ?? 0, clientY: touch?.clientY ?? 0 };
}

/**
 * Selection frame, eight drag handles and the align / delete toolbar over one image. It mutates the
 * image in place (inline size while dragging, `data-align` plus float and margin styles on alignment)
 * and reports through callbacks; it owns no history, so the caller records the entry.
 */
export class ImageResizer {
    labels: ImageResizerLabels = DEFAULT_LABELS;
    resizable = true;
    showAlignment = true;
    /** Lower clamp in px on both axes. */
    minWidth = 20;
    /** Upper clamp in px for the width; none when unset. */
    maxWidth: number | undefined;
    /** Corner drags keep the starting ratio; false frees the axes and shows the four edge handles. */
    lockAspectRatio = true;

    private image: HTMLImageElement | null = null;
    private box: ImageBox = { top: 0, left: 0, width: 0, height: 0 };
    private shown = false;
    private frame: number | null = null;
    private observer: ResizeObserver | null = null;
    private scrollTarget: HTMLElement | null = null;
    private drag: DragState | null = null;
    private keyboardTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly options: ImageResizerOptions) {}

    get target(): HTMLImageElement | null {
        return this.image;
    }

    get rect(): ImageBox {
        return this.box;
    }

    get visible(): boolean {
        return this.shown;
    }

    get alignment(): ImageAlignment {
        const align = this.image?.dataset['align'];
        return ALIGNMENTS.find((candidate) => candidate === align) ?? 'inline';
    }

    handleLabel(handle: ResizeHandle): string {
        return RESIZE_HANDLE_LABELS[handle];
    }

    /** Starts tracking `image` (or stops, for `null`); also re-binds to the container's current element. */
    setTarget(image: HTMLImageElement | null): void {
        this.image = image;
        this.stopTracking();
        if (image) {
            this.startTracking();
            return;
        }
        this.removePointerListeners();
        this.drag = null;
        this.shown = false;
    }

    dispose(): void {
        this.stopTracking();
        this.removePointerListeners();
        this.drag = null;
        this.image = null;
        if (this.keyboardTimer !== null) clearTimeout(this.keyboardTimer);
        this.keyboardTimer = null;
    }

    startResize(event: MouseEvent | TouchEvent, handle: ResizeHandle): void {
        event.preventDefault();
        event.stopPropagation();
        if (!this.image) return;
        const point = pointOf(event);
        const rect = this.image.getBoundingClientRect();
        this.drag = { startX: point.clientX, startY: point.clientY, startWidth: rect.width, startHeight: rect.height, handle };
        const { doc } = this.options;
        doc.addEventListener('mousemove', this.onPointerMove);
        doc.addEventListener('mouseup', this.onPointerUp);
        doc.addEventListener('touchmove', this.onPointerMove, { passive: false });
        doc.addEventListener('touchend', this.onPointerUp);
    }

    /** Pressed on mousedown (keeps the editor selection) and click (keyboard); a mouse press fires both, so only mousedown acts. */
    onAlignClick(event: MouseEvent, align: ImageAlignment): void {
        event.preventDefault();
        event.stopPropagation();
        if (this.consumedByMouse(event) || !this.image) return;
        this.image.dataset['align'] = align;
        applyImageAlignment(this.image, align);
        this.options.onAlign(align);
        this.scheduleUpdate();
    }

    onDeleteClick(event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();
        if (this.consumedByMouse(event) || !this.image) return;
        this.options.onRemove(this.image);
    }

    /** Arrow keys resize through the same sign tables the drag uses; Shift takes larger steps. */
    onResizeKeydown(event: KeyboardEvent, handle: ResizeHandle): void {
        const arrow = ARROWS[event.key];
        const image = this.image;
        if (!arrow || !image) return;
        const step = event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP;
        const dx = arrow.x * step * WIDTH_SIGN[handle];
        const dy = arrow.y * step * HEIGHT_SIGN[handle];
        // A key this handle cannot act on stays with the page, so its scroll is not eaten.
        if (dx === 0 && (dy === 0 || this.lockAspectRatio)) return;
        event.preventDefault();
        event.stopPropagation();

        const rect = image.getBoundingClientRect();
        const aspect = rect.height === 0 ? 1 : rect.width / rect.height;
        const requested = this.clampWidth(rect.width + dx);
        const size = this.lockAspectRatio ? this.ratioBoundedSize(requested, aspect) : { width: requested, height: this.clampHeight(rect.height + dy) };
        this.writeSize(image, size);
        this.scheduleUpdate();
        this.endKeyboardResizeSoon();
    }

    render(): TemplateResult | typeof nothing {
        if (!this.image) return nothing;
        const box = this.box;
        const frame = styleMap({
            top: `${box.top}px`,
            left: `${box.left}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
            display: this.shown ? 'block' : 'none',
        });
        return html`<div class="image-frame" data-slot="rte-image-resizer" style=${frame}>
            ${this.handles().map((handle) => html`<button
                type="button"
                class="image-handle"
                data-handle=${handle}
                aria-label=${this.handleLabel(handle)}
                @keydown=${(event: KeyboardEvent) => this.onResizeKeydown(event, handle)}
                @mousedown=${(event: MouseEvent) => this.startResize(event, handle)}
                @touchstart=${(event: TouchEvent) => this.startResize(event, handle)}
            ></button>`)}
            <div class="image-toolbar">
                ${this.showAlignment ? html`${ALIGNMENTS.map((align) => this.renderAlignment(align))}<div class="image-toolbar-divider"></div>` : nothing}
                <button
                    type="button"
                    class="image-action image-delete"
                    title=${this.labels.deleteImage}
                    aria-label=${this.labels.deleteImage}
                    @mousedown=${(event: MouseEvent) => this.onDeleteClick(event)}
                    @click=${(event: MouseEvent) => this.onDeleteClick(event)}
                >${unsafeHTML(DELETE_ICON)}</button>
            </div>
        </div>`;
    }

    private handles(): readonly ResizeHandle[] {
        if (!this.resizable) return [];
        return this.lockAspectRatio ? CORNERS : [...CORNERS, ...EDGES];
    }

    private renderAlignment(align: ImageAlignment): TemplateResult {
        const label = this.alignmentLabel(align);
        const active = this.alignment === align;
        return html`<button
            type="button"
            class="image-action"
            data-align=${align}
            title=${label}
            aria-label=${label}
            aria-pressed=${String(active)}
            ?data-active=${active}
            @mousedown=${(event: MouseEvent) => this.onAlignClick(event, align)}
            @click=${(event: MouseEvent) => this.onAlignClick(event, align)}
        >${unsafeHTML(ALIGNMENT_ICONS[align])}</button>`;
    }

    alignmentLabel(align: ImageAlignment): string {
        const { labels } = this;
        const byAlignment: Readonly<Record<ImageAlignment, string>> = { inline: labels.inline, left: labels.floatLeft, center: labels.center, right: labels.floatRight };
        return byAlignment[align];
    }

    private consumedByMouse(event: MouseEvent): boolean {
        return event.type === 'click' && event.detail > 0;
    }

    private startTracking(): void {
        const container = this.options.container();
        this.observer = new ResizeObserver(() => this.scheduleUpdate());
        if (this.image) this.observer.observe(this.image);
        if (container) {
            this.observer.observe(container);
            container.addEventListener('scroll', this.scheduleUpdate, { passive: true });
            this.scrollTarget = container;
        }
        this.options.doc.defaultView?.addEventListener('resize', this.scheduleUpdate);
        this.scheduleUpdate();
    }

    private stopTracking(): void {
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
        this.observer?.disconnect();
        this.observer = null;
        this.scrollTarget?.removeEventListener('scroll', this.scheduleUpdate);
        this.scrollTarget = null;
        this.options.doc.defaultView?.removeEventListener('resize', this.scheduleUpdate);
    }

    private readonly scheduleUpdate = (): void => {
        if (this.frame !== null) return;
        this.frame = requestAnimationFrame(() => {
            this.frame = null;
            this.updateRect();
        });
    };

    private updateRect(): void {
        const container = this.options.container();
        const origin = this.options.origin?.() ?? container;
        const before = this.box;
        const wasShown = this.shown;
        this.shown = false;
        if (this.image && container && origin) {
            const image = this.image.getBoundingClientRect();
            const clip = container.getBoundingClientRect();
            const base = origin.getBoundingClientRect();
            const outside = image.bottom < clip.top || image.top > clip.bottom || image.right < clip.left || image.left > clip.right;
            this.shown = !outside;
            if (this.shown) this.box = { top: image.top - base.top, left: image.left - base.left, width: image.width, height: image.height };
        }
        const moved = before.top !== this.box.top || before.left !== this.box.left || before.width !== this.box.width || before.height !== this.box.height;
        if (wasShown !== this.shown || moved) this.options.requestRender();
    }

    private readonly onPointerMove = (event: MouseEvent | TouchEvent): void => {
        const state = this.drag;
        const image = this.image;
        if (!state || !image) return;
        if ('touches' in event) event.preventDefault();
        const point = pointOf(event);
        const deltaX = point.clientX - state.startX;
        const deltaY = point.clientY - state.startY;
        this.writeSize(image, this.lockAspectRatio ? this.lockedSize(state, deltaX) : this.freeSize(state, deltaX, deltaY));
    };

    private readonly onPointerUp = (): void => {
        this.drag = null;
        this.removePointerListeners();
        this.options.onResizeEnd();
    };

    private removePointerListeners(): void {
        const { doc } = this.options;
        doc.removeEventListener('mousemove', this.onPointerMove);
        doc.removeEventListener('mouseup', this.onPointerUp);
        doc.removeEventListener('touchmove', this.onPointerMove);
        doc.removeEventListener('touchend', this.onPointerUp);
    }

    private writeSize(image: HTMLImageElement, size: Size): void {
        image.style.width = `${size.width}px`;
        image.style.height = `${size.height}px`;
    }

    /** One `onResizeEnd` for a run of keypresses, so a keyboard resize is one history entry like a drag. */
    private endKeyboardResizeSoon(): void {
        if (this.keyboardTimer !== null) clearTimeout(this.keyboardTimer);
        this.keyboardTimer = setTimeout(() => {
            this.keyboardTimer = null;
            this.options.onResizeEnd();
        }, KEYBOARD_COALESCE_MS);
    }

    private widthCeiling(): number {
        return Math.min(this.maxWidth ?? MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION);
    }

    private clampWidth(width: number): number {
        return Math.min(this.widthCeiling(), Math.max(this.minWidth, width));
    }

    /** `maxWidth` is a width ceiling and deliberately not applied to height. */
    private clampHeight(height: number): number {
        return Math.min(MAX_IMAGE_DIMENSION, Math.max(this.minWidth, height));
    }

    /** Scales both axes by one factor: floor first, ceiling last, so the ceiling always holds and the ratio is never bent. */
    private ratioBoundedSize(width: number, aspect: number): Size {
        const min = this.minWidth;
        const height = width / aspect;
        const underBy = Math.max(min / width, min / height, 1);
        const grown = { width: width * underBy, height: height * underBy };
        const overBy = Math.max(grown.width / this.widthCeiling(), grown.height / MAX_IMAGE_DIMENSION, 1);
        return { width: grown.width / overBy, height: grown.height / overBy };
    }

    private lockedSize(state: DragState, deltaX: number): Size {
        const width = this.clampWidth(state.startWidth + WIDTH_SIGN[state.handle] * deltaX);
        return this.ratioBoundedSize(width, state.startWidth / state.startHeight);
    }

    private freeSize(state: DragState, deltaX: number, deltaY: number): Size {
        return {
            width: this.clampWidth(state.startWidth + WIDTH_SIGN[state.handle] * deltaX),
            height: this.clampHeight(state.startHeight + HEIGHT_SIGN[state.handle] * deltaY),
        };
    }
}
