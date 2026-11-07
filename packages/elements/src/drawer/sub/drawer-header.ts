import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './drawer-header.css?inline';

/**
 * The heading block of a drawer.
 *
 * @slot - A `ge-drawer-title` and a `ge-drawer-description`.
 */
export class GeDrawerHeader extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
