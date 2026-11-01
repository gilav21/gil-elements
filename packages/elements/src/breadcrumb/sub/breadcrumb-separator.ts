import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './breadcrumb-separator.css?inline';

/**
 * The divider between crumbs. A chevron that mirrors in right-to-left text, unless you project your own.
 *
 * @slot - A custom divider, such as `/`. An svg is sized to 0.875rem.
 */
export class GeBreadcrumbSeparator extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'presentation');
        this.setAttribute('aria-hidden', 'true');
    }

    protected override render() {
        return html`<slot
            ><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg
        ></slot>`;
    }
}
