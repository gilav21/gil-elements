import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * Custom-mode trigger slot. It draws no box (`display: contents`), so style the element you project instead.
 *
 * @slot - Usually a `ge-popover-trigger`.
 */
export class GeTreeSelectTrigger extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(':host{display:contents}')];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'tree-select-trigger';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}

/**
 * Custom-mode content slot. It draws no box (`display: contents`), so style the element you project instead.
 *
 * @slot - Usually a `ge-popover-content`.
 */
export class GeTreeSelectContent extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(':host{display:contents}')];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'tree-select-content';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
