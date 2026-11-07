import { css, html } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { CAROUSEL_REGISTER, type CarouselHost } from '../carousel.js';

/**
 * The scrolling track: the element that actually scrolls, with hidden scrollbars and mandatory snapping. It is
 * focusable, so the arrow keys work after a click or a Tab. It carries a negative start margin that cancels the
 * slides' gutter, so change `margin-inline-start` and the slides' `padding-inline-start` together.
 */
export class GeCarouselContent extends UiElement {
    static override readonly styles = [
        UiElement.styles,
        css`
            :host {
                display: flex;
                margin-inline-start: -1rem;
                overflow-x: auto;
                scroll-snap-type: x mandatory;
                scroll-behavior: smooth;
                scrollbar-width: none;
                -ms-overflow-style: none;
            }
            :host::-webkit-scrollbar {
                display: none;
            }
            :host([data-orientation='vertical']) {
                flex-direction: column;
                margin-inline-start: 0;
                margin-top: -1rem;
                overflow-x: visible;
                overflow-y: auto;
                scroll-snap-type: y mandatory;
            }
        `,
    ];
    private host?: CarouselHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.tabIndex = 0;
        this.dataset.slot = 'carousel-content';
        this.host = findParent<CarouselHost, GeCarouselContent>(this, CAROUSEL_REGISTER);
        if (this.host) {
            this.dataset.orientation = this.host.orientation;
            this.host.attach(this, this);
        }
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.host?.detach(this);
    }

    protected override updated(): void {
        // Slides pick their gutter side from this; the carousel re-renders its parts when its orientation changes.
        if (this.host) this.dataset.orientation = this.host.orientation;
        this.syncItems();
    }

    private readonly onSlotChange = () => {
        this.syncItems();
        // Slides added or removed change the scroll range without resizing the track itself.
        this.host?.updateScrollState();
    };

    private syncItems(): void {
        for (const item of this.querySelectorAll<HTMLElement>('ge-carousel-item')) item.dataset.orientation = this.dataset.orientation;
    }

    protected override render() {
        if (this.host) this.dataset.orientation = this.host.orientation;
        return html`<slot @slotchange=${this.onSlotChange}></slot>`;
    }
}
