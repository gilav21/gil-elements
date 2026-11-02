import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './dialog-description.css?inline';

/**
 * A line of explanation under the title.
 *
 * @slot - The text.
 */
export class GeDialogDescription extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
