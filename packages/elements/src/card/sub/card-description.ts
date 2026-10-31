import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './card-description.css?inline';

/**
 * The muted line under a card's title.
 *
 * @slot - Description text.
 */
export class GeCardDescription extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
