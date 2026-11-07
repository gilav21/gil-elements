import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/** A thin rule between groups of items. It has no role: a listbox may only contain options and groups. */
export class GeSelectSeparator extends UiElement {
    static override readonly styles = [
        UiElement.styles,
        unsafeCSS(':host{display:block;height:1px;margin:0.25rem -0.25rem;background-color:var(--border);pointer-events:none}'),
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'select-separator';
    }

    protected override render() {
        return html``;
    }
}
