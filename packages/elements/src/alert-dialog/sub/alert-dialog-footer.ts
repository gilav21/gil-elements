import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './alert-dialog-footer.css?inline';

/**
 * The choices; stacks on a phone and sits at the end on wider screens.
 *
 * @slot - A `ge-alert-dialog-cancel` and a `ge-alert-dialog-action`.
 */
export class GeAlertDialogFooter extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
