import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './dialog-footer.css?inline';

/**
 * The action row of a dialog; stacks on a phone and sits at the end on wider screens.
 *
 * @slot - The buttons.
 */
export class GeDialogFooter extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
