import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './dialog-title.css?inline';

/**
 * The dialog's name.
 *
 * @slot - The text.
 */
export class GeDialogTitle extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
