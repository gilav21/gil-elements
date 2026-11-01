import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './pagination-previous.css?inline';

/**
 * The "previous page" button.
 *
 * @attr {string} label - Button text. Defaults to "Previous".
 * @attr {boolean} disabled - Blocks and dims it.
 * @csspart base - The `<button>`.
 */
export class GePaginationPrevious extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static override properties = {
        label: {},
        disabled: { type: Boolean, reflect: true },
    };

    declare label: string;
    declare disabled: boolean;

    constructor() {
        super();
        this.label = 'Previous';
        this.disabled = false;
    }

    protected override render() {
        return html`<button part="base" type="button" data-slot="pagination-previous" ?disabled=${this.disabled}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
            <span>${this.label}</span>
        </button>`;
    }
}
