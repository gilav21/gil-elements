import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './breadcrumb-link.css?inline';

/**
 * A link to an ancestor page.
 *
 * @slot - The link text.
 * @attr {string} href - Where it goes. Defaults to `#`.
 * @csspart base - The `<a>`.
 */
export class GeBreadcrumbLink extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static override properties = {
        href: { reflect: true },
    };

    declare href: string;

    constructor() {
        super();
        this.href = '#';
    }

    protected override render() {
        return html`<a part="base" href=${this.href} data-slot="breadcrumb-link"><slot></slot></a>`;
    }
}
