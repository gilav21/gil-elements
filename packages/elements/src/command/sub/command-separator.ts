import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/** A thin rule between groups. */
export class GeCommandSeparator extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(':host{display:block;height:1px;margin-inline:-0.25rem;background-color:var(--border)}')];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'command-separator';
    }

    protected override render() {
        return html``;
    }
}
