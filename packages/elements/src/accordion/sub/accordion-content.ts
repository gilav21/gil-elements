import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { ACCORDION_ITEM_REGISTER, type AccordionItemHost } from './accordion-item.js';
import css from './accordion-content.css?inline';

/**
 * The panel of an item. It is not rendered while the item is closed.
 *
 * @slot - The panel's content.
 * @csspart base - The panel wrapper.
 */
export class GeAccordionContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    private item?: AccordionItemHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.item = findParent<AccordionItemHost, GeAccordionContent>(this, ACCORDION_ITEM_REGISTER);
        this.item?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.item?.unregister(this);
        this.item = undefined;
    }

    protected override render() {
        if (!this.item?.isOpen) return nothing;
        return html`<div part="base" class="panel" data-slot="accordion-content" data-state="open"><div class="inner"><slot></slot></div></div>`;
    }
}
