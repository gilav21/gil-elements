import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * A heading inside the menu. It is not an item: the arrow keys skip it.
 *
 * @slot - The text.
 */
export class GeDropdownMenuLabel extends UiElement {
    static override styles = [
        UiElement.styles,
        unsafeCSS(':host{display:block;padding:0.375rem 0.5rem;font-size:0.875rem;line-height:1.25rem;font-weight:600}'),
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'dropdown-label';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
