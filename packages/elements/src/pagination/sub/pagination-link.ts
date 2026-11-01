import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './pagination-link.css?inline';

export type PaginationLinkSize = 'default' | 'sm' | 'lg' | 'icon';

/**
 * A page number button.
 *
 * @slot - The label, usually the page number.
 * @attr {boolean} active - Marks the current page: outlined, and `aria-current="page"`.
 * @attr {'default' | 'sm' | 'lg' | 'icon'} size - Button size. Defaults to `icon`, a square sized for a number.
 * @attr {boolean} disabled - Blocks and dims it.
 * @csspart base - The `<button>`.
 * @cssprop --density-button - Size multiplier; falls back to `--density`.
 */
export class GePaginationLink extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static override properties = {
        active: { type: Boolean, reflect: true },
        size: { reflect: true },
        disabled: { type: Boolean, reflect: true },
    };

    declare active: boolean;
    declare size: PaginationLinkSize;
    declare disabled: boolean;

    constructor() {
        super();
        this.active = false;
        this.size = 'icon';
        this.disabled = false;
    }

    protected override render() {
        return html`<button
            part="base"
            type="button"
            data-slot="pagination-link"
            data-size=${this.size}
            aria-current=${this.active ? 'page' : nothing}
            ?disabled=${this.disabled}
        >
            <slot></slot>
        </button>`;
    }
}
