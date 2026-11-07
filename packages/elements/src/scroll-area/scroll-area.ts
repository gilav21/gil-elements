import { html, nothing, unsafeCSS } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import { UiElement } from '@gilav21/elements-base';
import css from './scroll-area.css?inline';

export type ScrollAreaOrientation = 'vertical' | 'horizontal' | 'both';
type Axis = 'vertical' | 'horizontal';

interface Metrics {
    scrollTop: number;
    scrollLeft: number;
    scrollHeight: number;
    scrollWidth: number;
    clientHeight: number;
    clientWidth: number;
}

const EMPTY: Metrics = { scrollTop: 0, scrollLeft: 0, scrollHeight: 0, scrollWidth: 0, clientHeight: 0, clientWidth: 0 };

/** Thumb length as a share of the track, never under a tenth so it stays grabbable. */
const thumbPercent = (client: number, scroll: number) => (scroll === 0 ? 100 : Math.max(10, (client / scroll) * 100));

/** Thumb offset as a share of the track, from how far the content has scrolled. */
const offsetPercent = (position: number, scroll: number, client: number, thumb: number) =>
    scroll === client ? 0 : (position / (scroll - client)) * (100 - thumb);

/**
 * A clipped box whose content scrolls under thin custom scrollbars. The native scrollbars are always hidden and
 * the viewport scrolls in both axes; `orientation` only decides which styled thumbs may appear, and each shows only
 * while its content overflows. The host is the root: give it a height (or `max-height`), or there is nothing to scroll.
 *
 * The thumbs are sized on resize and on scroll. Content that changes height without resizing the box needs a nudge,
 * such as `scrollToBottom()`, to refresh them.
 *
 * @slot - The content to scroll.
 * @attr {'vertical' | 'horizontal' | 'both'} orientation - Which custom scrollbars may appear. Defaults to `vertical`.
 * @csspart viewport - The scrolling element.
 * @csspart scrollbar - A scrollbar track; `data-orientation` says which.
 * @csspart thumb - A scrollbar thumb.
 */
export class GeScrollArea extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        orientation: { reflect: true },
        metrics: { state: true },
    };

    declare orientation: ScrollAreaOrientation;
    declare metrics: Metrics;

    private readonly viewport = createRef<HTMLElement>();
    private readonly resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => this.measure());
    private drag?: AbortController;

    constructor() {
        super();
        this.orientation = 'vertical';
        this.metrics = EMPTY;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'scroll-area';
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.resizeObserver?.disconnect();
        this.drag?.abort();
    }

    protected override firstUpdated(): void {
        this.measure();
        const viewport = this.viewport.value;
        if (viewport) this.resizeObserver?.observe(viewport);
    }

    /** Jumps to the end of the content, after layout, so it is safe to call right after appending (the chat or log case). Instant, never smooth. */
    scrollToBottom(): void {
        requestAnimationFrame(() => {
            const viewport = this.viewport.value;
            if (!viewport) return;
            viewport.scrollTop = viewport.scrollHeight;
            this.measure();
        });
    }

    private measure(): void {
        const v = this.viewport.value;
        if (!v) return;
        const { scrollTop, scrollLeft, scrollHeight, scrollWidth, clientHeight, clientWidth } = v;
        this.metrics = { scrollTop, scrollLeft, scrollHeight, scrollWidth, clientHeight, clientWidth };
    }

    private get showVertical(): boolean {
        const { scrollHeight, clientHeight } = this.metrics;
        return (this.orientation === 'vertical' || this.orientation === 'both') && scrollHeight > clientHeight;
    }

    private get showHorizontal(): boolean {
        const { scrollWidth, clientWidth } = this.metrics;
        return (this.orientation === 'horizontal' || this.orientation === 'both') && scrollWidth > clientWidth;
    }

    protected override render() {
        const m = this.metrics;
        const height = thumbPercent(m.clientHeight, m.scrollHeight);
        const width = thumbPercent(m.clientWidth, m.scrollWidth);
        const both = this.showVertical && this.showHorizontal;
        return html`<div ${ref(this.viewport)} class="viewport" part="viewport" data-slot="scroll-area-viewport" tabindex="0" @scroll=${this.measure}>
                <slot></slot>
            </div>
            ${this.showVertical
                ? html`<div class="scrollbar vertical" part="scrollbar" data-slot="scroll-area-scrollbar" data-orientation="vertical">
                      <div
                          class="thumb"
                          part="thumb"
                          data-slot="scroll-area-thumb"
                          style="height:${height}%;top:${offsetPercent(m.scrollTop, m.scrollHeight, m.clientHeight, height)}%"
                          @mousedown=${(e: MouseEvent) => this.startDrag(e, 'vertical')}
                          @touchstart=${(e: TouchEvent) => this.startDrag(e, 'vertical')}
                      ></div>
                  </div>`
                : nothing}
            ${this.showHorizontal
                ? html`<div class="scrollbar horizontal" part="scrollbar" data-slot="scroll-area-scrollbar" data-orientation="horizontal">
                      <div
                          class="thumb"
                          part="thumb"
                          data-slot="scroll-area-thumb"
                          style="width:${width}%;left:${offsetPercent(m.scrollLeft, m.scrollWidth, m.clientWidth, width)}%"
                          @mousedown=${(e: MouseEvent) => this.startDrag(e, 'horizontal')}
                          @touchstart=${(e: TouchEvent) => this.startDrag(e, 'horizontal')}
                      ></div>
                  </div>`
                : nothing}
            ${both ? html`<div class="corner"></div>` : nothing}`;
    }

    /** Drags a thumb with the mouse or a finger. Movement is scaled by the content-to-box ratio so the thumb follows the pointer. */
    private startDrag(event: MouseEvent | TouchEvent, axis: Axis): void {
        // Stops text selection and page panning for the length of the drag.
        event.preventDefault();
        const viewport = this.viewport.value;
        if (!viewport) return;
        const start = 'touches' in event ? event.touches[0] : event;
        if (!start) return;
        const { scrollTop, scrollLeft } = viewport;
        this.drag?.abort();
        const drag = new AbortController();
        this.drag = drag;
        const { signal } = drag;
        const move = (x: number, y: number) => {
            if (axis === 'vertical') viewport.scrollTop = scrollTop + (y - start.clientY) * (viewport.scrollHeight / viewport.clientHeight);
            else viewport.scrollLeft = scrollLeft + (x - start.clientX) * (viewport.scrollWidth / viewport.clientWidth);
        };
        const end = () => drag.abort();
        globalThis.addEventListener('mousemove', (e) => move(e.clientX, e.clientY), { signal });
        globalThis.addEventListener('touchmove', (e) => e.touches[0] && move(e.touches[0].clientX, e.touches[0].clientY), { signal, passive: false });
        for (const type of ['mouseup', 'touchend', 'touchcancel']) globalThis.addEventListener(type, end, { signal });
    }
}
