import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * A heading inside the menu. It is not an item: the arrow keys skip it.
 *
 * @slot - The text.
 * @attr {boolean} inset - Indents the text to line up with rows that carry an icon.
 */
export class GeContextMenuLabel extends UiElement {
    static override styles = [
        UiElement.styles,
        unsafeCSS(':host{display:block;padding:0.375rem 0.5rem;font-size:0.875rem;line-height:1.25rem;font-weight:600;color:var(--foreground)}:host([inset]){padding-inline-start:2rem}'),
    ];
    static override properties = { inset: { type: Boolean, reflect: true } };

    declare inset: boolean;

    constructor() {
        super();
        this.inset = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'context-menu-label';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
