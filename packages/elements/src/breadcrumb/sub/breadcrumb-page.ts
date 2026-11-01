import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './breadcrumb-page.css?inline';

/**
 * The current page: plain text that announces itself as the current, disabled link.
 *
 * @slot - The page name.
 */
export class GeBreadcrumbPage extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'link');
        this.setAttribute('aria-disabled', 'true');
        this.setAttribute('aria-current', 'page');
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
