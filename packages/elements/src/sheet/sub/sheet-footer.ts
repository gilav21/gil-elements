import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './sheet-footer.css?inline';

/**
 * The action row of a sheet; stacks on a phone and sits at the end on wider screens.
 *
 * @slot - The buttons.
 */
export class GeSheetFooter extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
