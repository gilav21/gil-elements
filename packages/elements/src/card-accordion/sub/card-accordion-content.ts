import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { ACCORDION_ITEM_REGISTER, type AccordionItemHost } from '../../accordion/sub/accordion-item.js';
import css from './card-accordion-content.css?inline';

/**
 * The body of a card in custom mode. Unlike `ge-accordion-content` it is always rendered, so its height can
 * animate; while closed it is `inert`, which keeps it out of the tab order and the accessibility tree.
 *
 * @slot - The panel's content.
 * @csspart base - The animating grid wrapper.
 * @cssprop --density-card-accordion - Spacing multiplier; falls back to `--density`.
 */
export class GeCardAccordionContent extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];

    private item?: AccordionItemHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.item = findParent<AccordionItemHost, GeCardAccordionContent>(this, ACCORDION_ITEM_REGISTER);
        this.item?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.item?.unregister(this);
        this.item = undefined;
    }

    protected override render() {
        const open = this.item?.isOpen ?? false;
        return html`<div part="base" class="panel" data-slot="card-accordion-content" data-state=${open ? 'open' : 'closed'}>
            <div class="clip"><div class="body" data-slot="card-accordion-body" ?inert=${!open}><slot></slot></div></div>
        </div>`;
    }
}
