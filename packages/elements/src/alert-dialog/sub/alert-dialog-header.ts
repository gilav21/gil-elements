import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './alert-dialog-header.css?inline';

/**
 * The heading block of an alert dialog.
 *
 * @slot - A `ge-alert-dialog-title` and a `ge-alert-dialog-description`.
 */
export class GeAlertDialogHeader extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
