import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './alert-dialog-title.css?inline';

/**
 * The question or warning.
 *
 * @slot - The text.
 */
export class GeAlertDialogTitle extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
