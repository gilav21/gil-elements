import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './empty-content.css?inline';

/**
 * The actions under an empty state, stacked and centred.
 *
 * @slot - Buttons, links or anything else.
 */
export class GeEmptyContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
