import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './breadcrumb-item.css?inline';

/**
 * One crumb: a `ge-breadcrumb-link` or a `ge-breadcrumb-page`.
 *
 * @slot - The crumb's content.
 */
export class GeBreadcrumbItem extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
