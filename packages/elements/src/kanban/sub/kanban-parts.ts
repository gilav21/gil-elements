import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * The content of a card you lay out yourself. It supplies only the card's `0.75rem` padding.
 *
 * @slot - Anything.
 */
export class GeKanbanCardContent extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(':host{display:block;padding:0.75rem}')];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'kanban-card-content';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}

/**
 * A column header you lay out yourself. Projecting one replaces the built-in header, so the count badge, add button and
 * collapse toggle are yours to reproduce.
 *
 * @slot - Anything.
 */
export class GeKanbanColumnHeader extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(':host{display:flex;align-items:center;justify-content:space-between;padding:0.75rem}')];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'kanban-column-header';
        this.slot = 'header';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
