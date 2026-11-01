import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './pagination-item.css?inline';

/**
 * One cell of the row: a link, previous, next or ellipsis.
 *
 * @slot - The item's children.
 */
export class GePaginationItem extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
