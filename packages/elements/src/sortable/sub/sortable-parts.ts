import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * Marks where a row is grabbed when the list is `handle-only`. It draws a grab cursor and keeps touch from scrolling;
 * the row itself starts the drag.
 *
 * @slot - The grip: an icon or text.
 */
export class GeSortableHandle extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(':host{display:inline-flex;touch-action:none;cursor:grab}:host(:active){cursor:grabbing}')];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'sortable-handle';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}

/**
 * The preview shown at the drop gap while dragging. Its content is copied there. Without one the gap shows a faded
 * copy of the dragged row. It draws nothing itself.
 *
 * @slot - What the gap should show.
 */
export class GeSortableGhost extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(':host{display:none}')];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'sortable-ghost-template';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}

/**
 * What stays at the row's original position while it is dragged. Its content is copied into a box the size of the
 * row. Without one the box is dashed. It draws nothing itself.
 *
 * @slot - What the origin should show.
 */
export class GeSortablePlaceholder extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(':host{display:none}')];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'sortable-placeholder-template';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
