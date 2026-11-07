import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../shared/compound.js';
import css from './carousel.css?inline';
import type { GeCarouselContent } from './sub/carousel-content.js';

export const CAROUSEL_REGISTER = 'ge-carousel-register';
export type CarouselOrientation = 'horizontal' | 'vertical';

/** What the parts need from their carousel. */
export interface CarouselHost extends HTMLElement {
    readonly orientation: CarouselOrientation;
    readonly rtl: boolean;
    readonly canScrollPrev: boolean;
    readonly canScrollNext: boolean;
    scrollPrev(): void;
    scrollNext(): void;
    updateScrollState(): void;
    attach(part: HTMLElement & { requestUpdate(): void }, content?: GeCarouselContent): void;
    detach(part: HTMLElement): void;
}

/**
 * A scroll-snapping row or column of slides with previous and next buttons.
 *
 * Put a `ge-carousel-content` in it, `ge-carousel-item`s in that, and optionally `ge-carousel-previous` and
 * `ge-carousel-next`. The host is the positioned root: size it with a class or style, and keep it positioned,
 * because the buttons are placed against it (inside its edges on a phone, just outside them from 640px).
 *
 * Left and Right page a horizontal carousel, Up and Down a vertical one. The buttons follow the page direction:
 * "next" always means the next slide, also in RTL.
 *
 * @fires slide-change - After the first visible slide changes; `detail` is its index. Assumes slides of one size.
 * @attr {'horizontal' | 'vertical'} orientation - Scroll axis. Defaults to `horizontal`.
 */
export class GeCarousel extends UiElement implements CarouselHost {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        orientation: { reflect: true },
        canScrollPrev: { state: true },
        canScrollNext: { state: true },
        currentIndex: { state: true },
        rtl: { state: true },
    };
    declare orientation: CarouselOrientation;
    declare canScrollPrev: boolean;
    declare canScrollNext: boolean;
    /** Index of the first visible slide. */
    declare currentIndex: number;
    declare rtl: boolean;

    private content?: GeCarouselContent;
    private readonly parts = new Set<HTMLElement & { requestUpdate(): void }>();
    private resizeObserver?: ResizeObserver;
    private dirObserver?: MutationObserver;

    constructor() {
        super();
        this.orientation = 'horizontal';
        this.canScrollPrev = false;
        this.canScrollNext = true;
        this.currentIndex = 0;
        this.rtl = false;
        adoptChildren<CarouselHost, HTMLElement>(this, CAROUSEL_REGISTER, () => undefined);
        this.addEventListener('keydown', this.onKeydown);
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'region');
        this.setAttribute('aria-roledescription', 'carousel');
        this.dataset.slot = 'carousel';
        this.syncDirection();
        // A dir attribute anywhere above flips the buttons; the document's is the common one.
        this.dirObserver = new MutationObserver(() => this.syncDirection());
        this.dirObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.dirObserver?.disconnect();
        this.resizeObserver?.disconnect();
    }

    attach(part: HTMLElement & { requestUpdate(): void }, content?: GeCarouselContent): void {
        this.parts.add(part);
        if (!content) return;
        this.content = content;
        content.addEventListener('scroll', () => this.updateScrollState());
        this.resizeObserver?.disconnect();
        this.resizeObserver = new ResizeObserver(() => this.updateScrollState());
        this.resizeObserver.observe(content);
        this.syncDirection();
    }

    detach(part: HTMLElement): void {
        this.parts.delete(part as HTMLElement & { requestUpdate(): void });
    }

    private syncDirection(): void {
        this.rtl = getComputedStyle(this).direction === 'rtl';
        this.updateScrollState();
    }

    protected override updated(): void {
        for (const part of this.parts) part.requestUpdate();
    }

    /** Recomputes the scroll state from the content's live metrics; call it after adding or removing slides. */
    updateScrollState(): void {
        const content = this.content;
        if (!content) return;
        const horizontal = this.orientation === 'horizontal';
        const offset = horizontal ? Math.abs(content.scrollLeft) : content.scrollTop;
        const max = horizontal ? content.scrollWidth - content.clientWidth : content.scrollHeight - content.clientHeight;
        this.canScrollPrev = offset >= 1;
        this.canScrollNext = offset < max - 1;
        const first = content.querySelector<HTMLElement>('ge-carousel-item');
        const size = first ? (horizontal ? first.offsetWidth : first.offsetHeight) : 0;
        if (size > 0) {
            const index = Math.round(offset / size);
            if (index !== this.currentIndex) {
                this.currentIndex = index;
                this.dispatchEvent(new CustomEvent('slide-change', { detail: index, bubbles: true, composed: true }));
            }
        }
    }

    private scrollByPage(sign: 1 | -1): void {
        const content = this.content;
        if (!content) return;
        const horizontal = this.orientation === 'horizontal';
        const page = horizontal ? content.clientWidth : content.clientHeight;
        const direction = horizontal && this.rtl ? -sign : sign;
        content.scrollBy({ [horizontal ? 'left' : 'top']: page * direction, behavior: 'smooth' });
    }

    /** Smooth-scrolls back by one viewport of the content. */
    scrollPrev(): void {
        this.scrollByPage(-1);
    }

    /** Smooth-scrolls forward by one viewport of the content; it pages by viewport, not by slide. */
    scrollNext(): void {
        this.scrollByPage(1);
    }

    /** Smooth-scrolls the slide at `index` into view; an index out of range is ignored. */
    scrollToSlide(index: number): void {
        this.content?.querySelectorAll<HTMLElement>('ge-carousel-item')[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }

    private readonly onKeydown = (event: KeyboardEvent) => {
        const horizontal = this.orientation === 'horizontal';
        const prev = horizontal ? 'ArrowLeft' : 'ArrowUp';
        const next = horizontal ? 'ArrowRight' : 'ArrowDown';
        if (event.key !== prev && event.key !== next) return;
        event.preventDefault();
        if (event.key === prev) this.scrollPrev();
        else this.scrollNext();
    };

    protected override render() {
        return html`<slot></slot>`;
    }
}
