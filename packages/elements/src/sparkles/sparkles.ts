import { html, svg, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './sparkles.css?inline';

const STAR = svg`<path d="M80 0C80 0 84.2846 41.2925 101.496 58.504C118.707 75.7154 160 80 160 80C160 80 118.707 84.2846 101.496 101.496C84.2846 118.707 80 160 80 160C80 160 75.7154 118.707 58.504 101.496C41.2925 84.2846 0 80 0 80C0 80 41.2925 75.7154 58.504 58.504C75.7154 41.2925 80 0 80 0Z" class="star" fill="currentColor" />`;

/**
 * A four-point star that pulses outward and fades, over and over. It is absolutely placed and click-through, so its
 * positioning parent must be `position: relative`. Place and size it with `top`/`inset-inline-start`/`width`/`height`
 * on the element, colour it with `color` (the star fills with `currentColor`) and offset several with `animation-delay`.
 * Under `prefers-reduced-motion: reduce` it holds still.
 *
 * @csspart svg - The star's drawing.
 */
export class GeSparkles extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'sparkles';
    }

    protected override render() {
        return html`<svg part="svg" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${STAR}</svg>`;
    }
}
