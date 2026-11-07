import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * Items that belong together, usually under a `ge-select-label`.
 *
 * @slot - A label and items.
 */
export class GeSelectGroup extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(':host{display:contents}')];

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'group');
        this.dataset.slot = 'select-group';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
