import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './card-title.css?inline';

/**
 * A card's title. Renders as a styled block, not a heading element: slot your own `<h2>` or
 * `<h3>` inside when the card must appear in the document outline.
 *
 * @slot - Title text.
 */
export class GeCardTitle extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
