import { css, html } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * One slide. It takes the full width of the track (one slide per view): set `flex-basis` on it to show several
 * at once, such as `50%`. Its start gutter pairs with the track's negative margin, so keep them together.
 */
export class GeCarouselItem extends UiElement {
    static override readonly styles = [
        UiElement.styles,
        css`
            :host {
                display: block;
                box-sizing: border-box;
                flex: 0 0 100%;
                min-width: 0;
                padding-inline-start: 1rem;
                scroll-snap-align: start;
            }
            :host([data-orientation='vertical']) {
                padding-inline-start: 0;
                padding-top: 1rem;
            }
        `,
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'group');
        this.setAttribute('aria-roledescription', 'slide');
        this.dataset.slot = 'carousel-item';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
