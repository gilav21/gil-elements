import { html } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * Marks a replacement for the built-in toolbar. A direct child of `ge-file-viewer`, it switches the viewer to
 * fully custom content: nothing built in is drawn, so the page and zoom are yours to drive. It draws no box.
 */
export class GeFileViewerToolbar extends UiElement {
    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'file-viewer-toolbar-slot';
        this.style.display = 'contents';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}

/** Marks a replacement for the built-in content area; see `ge-file-viewer-toolbar`. It draws no box. */
export class GeFileViewerContent extends UiElement {
    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'file-viewer-content-slot';
        this.style.display = 'contents';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
