import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './card-content.css?inline';

/**
 * A card's body. It only supplies the horizontal padding that lines up with the header.
 *
 * @slot - Anything.
 */
export class GeCardContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
