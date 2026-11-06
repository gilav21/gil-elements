import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { GeAccordionItem } from '../../accordion/sub/accordion-item.js';
import css from './card-accordion-item.css?inline';

const CHEVRON = html`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
</svg>`;

/**
 * One card of a `ge-card-accordion`. Give it a `heading` (with `description` and `content`) for the quick form,
 * or project a `ge-card-accordion-trigger` and `ge-card-accordion-content` for full control.
 *
 * @slot - A `ge-card-accordion-trigger` and `ge-card-accordion-content`, used when there is no `heading`.
 * @attr {string} value - Identifies the item in the accordion's `value`. Required.
 * @attr {string} heading - Quick form: the card's title.
 * @attr {string} description - Quick form: a muted line under the title.
 * @attr {string} content - Quick form: the body text.
 * @attr {boolean} skeleton - Shows placeholders in place of the header and body.
 * @csspart base - The card surface.
 */
export class GeCardAccordionItem extends GeAccordionItem {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = { ...GeAccordionItem.properties, description: {} };

    declare description: string;

    constructor() {
        super();
        this.description = '';
    }

    protected override render() {
        const state = this.isOpen ? 'open' : 'closed';
        return html`<div part="base" class="card" data-slot="card-accordion-item" data-state=${state}>
            ${this.skeleton ? this.renderSkeletonCard() : this.heading ? this.renderCard(state) : html`<slot></slot>`}
        </div>`;
    }

    private renderSkeletonCard() {
        return html`<div class="skeleton">
            <div class="stack"><ge-skeleton></ge-skeleton><ge-skeleton></ge-skeleton></div>
            <ge-skeleton></ge-skeleton>
        </div>`;
    }

    private renderCard(state: string) {
        const open = state === 'open';
        return html`<h3>
                <button type="button" data-slot="card-accordion-trigger" data-state=${state} aria-expanded=${String(open)} @click=${() => this.toggle()}>
                    <span class="heading">
                        <span class="title">${this.heading}</span>
                        ${this.description ? html`<span class="description">${this.description}</span>` : nothing}
                    </span>
                    ${CHEVRON}
                </button>
            </h3>
            <div class="panel" data-state=${state} data-slot="card-accordion-content">
                <div class="clip"><div class="body" data-slot="card-accordion-body" ?inert=${!open}>${this.content}</div></div>
            </div>`;
    }
}
