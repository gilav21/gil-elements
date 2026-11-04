import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { SPLIT_BUTTON_REGISTER, type SplitButtonHost } from '../split-button.js';
import css from './split-button-item.css?inline';

/**
 * One row of the menu, for custom mode. Activating it fires the split button's `item-click` with
 * `{ label: '', value }` and closes the menu, so tell rows apart by `value`.
 *
 * @attr {string} value - Identifier carried on the `item-click` payload.
 * @attr {boolean} disabled - Greys the row, blocks pointer events and skips it with the arrow keys.
 */
export class GeSplitButtonItem extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static override properties = {
        value: {},
        disabled: { type: Boolean, reflect: true },
    };
    declare value: string;
    declare disabled: boolean;

    private host: SplitButtonHost | undefined;

    constructor() {
        super();
        this.value = '';
        this.disabled = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'split-button-item';
        this.host = findParent<SplitButtonHost, GeSplitButtonItem>(this, SPLIT_BUTTON_REGISTER);
    }

    private readonly onClick = () => {
        this.host?.activate({ label: '', value: this.value });
    };

    protected override render() {
        return html`<button class="item" type="button" role="menuitem" tabindex="-1" data-slot="split-button-item" ?disabled=${this.disabled} @click=${this.onClick}>
            <slot></slot>
        </button>`;
    }
}
