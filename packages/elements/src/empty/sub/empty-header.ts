import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './empty-header.css?inline';

/**
 * Groups an empty state's media, title and description.
 *
 * @slot - `ge-empty-media`, `ge-empty-title`, `ge-empty-description`.
 */
export class GeEmptyHeader extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
