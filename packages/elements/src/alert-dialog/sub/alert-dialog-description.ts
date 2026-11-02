import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './alert-dialog-description.css?inline';

/**
 * What the choice means.
 *
 * @slot - The text.
 */
export class GeAlertDialogDescription extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
