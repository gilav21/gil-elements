import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/** A thin rule between groups of items. */
export class GeMenubarSeparator extends UiElement {
    static override readonly styles = [
        UiElement.styles,
        unsafeCSS(':host{display:block;height:1px;margin:0.25rem -0.25rem;background-color:var(--muted)}'),
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'separator');
        this.dataset.slot = 'menubar-separator';
    }

    protected override render() {
        return html``;
    }
}
