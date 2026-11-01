import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './pagination-content.css?inline';

/**
 * The row that holds the items.
 *
 * @slot - The content's children.
 */
export class GePaginationContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
