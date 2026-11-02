import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './dialog-header.css?inline';

/**
 * The heading block of a dialog: its title and description.
 *
 * @slot - A `ge-dialog-title` and a `ge-dialog-description`.
 */
export class GeDialogHeader extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
