import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { ACCORDION_ITEM_REGISTER, type AccordionItemHost } from './accordion-item.js';
import css from './accordion-trigger.css?inline';

/**
 * The heading button of an item. Pressing it opens or closes the item.
 *
 * `aria-controls` is left out on purpose: the button and the panel live in different shadow trees, where an id
 * reference cannot resolve, and `aria-expanded` already carries the state.
 *
 * @slot - The label.
 * @csspart base - The `<button>`.
 * @cssprop --density-accordion - Vertical padding multiplier; falls back to `--density`.
 */
export class GeAccordionTrigger extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };

    private item?: AccordionItemHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.item = findParent<AccordionItemHost, GeAccordionTrigger>(this, ACCORDION_ITEM_REGISTER);
        this.item?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.item?.unregister(this);
        this.item = undefined;
    }

    protected override render() {
        const open = this.item?.isOpen ?? false;
        return html`<h3>
            <button
                part="base"
                type="button"
                data-slot="accordion-trigger"
                data-state=${open ? 'open' : 'closed'}
                aria-expanded=${String(open)}
                @click=${this.toggle}
            >
                <slot></slot>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
        </h3>`;
    }

    private readonly toggle = () => this.item?.toggle();
}
