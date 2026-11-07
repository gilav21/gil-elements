import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { ACCORDION_ITEM_REGISTER, type AccordionItemHost } from '../../accordion/sub/accordion-item.js';
import css from './card-accordion-trigger.css?inline';

/**
 * The header of a card in custom mode: the label toggles the card, a `ge-card-accordion-actions` beside it does not.
 *
 * @slot - The label.
 * @slot actions - A `ge-card-accordion-actions` (it assigns itself here).
 * @csspart base - The label's `<button>`.
 * @cssprop --density-card-accordion - Spacing multiplier; falls back to `--density`.
 */
export class GeCardAccordionTrigger extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };

    private item?: AccordionItemHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.item = findParent<AccordionItemHost, GeCardAccordionTrigger>(this, ACCORDION_ITEM_REGISTER);
        this.item?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.item?.unregister(this);
        this.item = undefined;
    }

    protected override render() {
        const state = this.item?.isOpen ? 'open' : 'closed';
        return html`<div class="row">
            <button part="base" class="toggle" type="button" data-slot="card-accordion-trigger" data-state=${state} aria-expanded=${String(state === 'open')} @click=${this.toggle}>
                <span class="label"><slot></slot></span>
            </button>
            <slot name="actions"></slot>
            <button class="chevron" type="button" tabindex="-1" aria-hidden="true" data-slot="card-accordion-chevron" data-state=${state} @click=${this.toggle}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
        </div>`;
    }

    private readonly toggle = () => this.item?.toggle();
}
