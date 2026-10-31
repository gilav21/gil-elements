import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './card-header.css?inline';

/**
 * The top of a card: a title, an optional description and an optional action.
 *
 * @slot - `ge-card-title` and `ge-card-description`.
 * @slot action - A control placed top-end, beside the title and description (for example a button).
 * @attr {boolean} bordered - Draw a divider under the header and add matching bottom padding.
 */
export class GeCardHeader extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = { bordered: { type: Boolean, reflect: true } };

    declare bordered: boolean;

    constructor() {
        super();
        this.bordered = false;
    }

    protected override render() {
        return html`<slot></slot><slot name="action"></slot>`;
    }
}
