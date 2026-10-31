import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './empty.css?inline';

/**
 * A placeholder for a view with nothing to show yet.
 *
 * @slot - `ge-empty-header` (media, title, description) and `ge-empty-content` (actions).
 */
export class GeEmpty extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
