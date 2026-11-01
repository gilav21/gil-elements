import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './empty-title.css?inline';

/**
 * An empty state's title.
 *
 * @slot - Title text.
 */
export class GeEmptyTitle extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
