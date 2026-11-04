import { UiElement } from '@gilav21/elements-base';
import { html } from 'lit';

/**
 * The menu's rows, for custom mode. Put `ge-split-button-item`s inside; the split button draws the panel.
 * Ignored while the split button has `items`.
 */
export class GeSplitButtonMenu extends UiElement {
    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'menu');
        this.tabIndex = -1;
        this.dataset.slot = 'split-button-menu';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
