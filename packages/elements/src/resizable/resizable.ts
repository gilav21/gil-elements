import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './resizable.css?inline';

export type ResizableDirection = 'horizontal' | 'vertical';

/**
 * A row or column of resizable panels separated by handles.
 *
 * Put `ge-resizable-panel`s in it with a `ge-resizable-handle` between each pair. A vertical group is `height: 100%`,
 * so give its parent a height or the panels collapse. Handles follow the group's `direction` when it changes.
 *
 * @attr {'horizontal' | 'vertical'} direction - Axis the panels are laid out and resized along. Defaults to `horizontal`.
 */
export class GeResizablePanelGroup extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = { direction: { reflect: true } };
    declare direction: ResizableDirection;

    constructor() {
        super();
        this.direction = 'horizontal';
        // A panel's size is what its neighbours' handles report as their value.
        this.addEventListener('size-change', () => this.refreshHandles());
    }

    private refreshHandles(): void {
        for (const handle of this.querySelectorAll<HTMLElement & { requestUpdate(): void }>('ge-resizable-handle')) handle.requestUpdate();
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'resizable-panel-group';
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('direction')) this.refreshHandles();
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
