import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './card-accordion-actions.css?inline';

/**
 * A row of controls beside a card's header. It sits outside the toggle button, so pressing one never toggles the
 * card, and every click inside it stops here: wire handlers on the controls themselves.
 *
 * @slot - Buttons or other controls.
 */
export class GeCardAccordionActions extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];

    override connectedCallback(): void {
        super.connectedCallback();
        this.slot = 'actions';
        this.addEventListener('click', stop);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('click', stop);
    }

    protected override render() {
        return html`<div class="actions" data-slot="card-accordion-actions"><slot></slot></div>`;
    }
}

const stop = (event: Event): void => event.stopPropagation();
