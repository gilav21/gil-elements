import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * The text of a tree item. It assigns itself to the item's label slot, so write it as a plain child.
 *
 * @slot - The label; long text is clipped with an ellipsis.
 */
export class GeTreeLabel extends UiElement {
    static override readonly styles = [
        UiElement.styles,
        unsafeCSS(':host{display:block;flex:1 1 0%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'),
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        this.slot = 'label';
        this.dataset.slot = 'tree-label';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
