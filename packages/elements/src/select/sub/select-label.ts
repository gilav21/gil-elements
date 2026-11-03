import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * A heading inside the panel. It is not an item: the arrow keys skip it.
 *
 * @slot - The text.
 */
export class GeSelectLabel extends UiElement {
    static override styles = [
        UiElement.styles,
        unsafeCSS(':host{display:block;padding:0.375rem 0.5rem;font-size:0.75rem;line-height:1rem;color:var(--muted-foreground)}'),
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'select-label';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
