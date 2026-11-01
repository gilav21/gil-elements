import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './sheet-header.css?inline';

/**
 * The heading block of a sheet.
 *
 * @slot - A `ge-sheet-title` and a `ge-sheet-description`.
 */
export class GeSheetHeader extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
