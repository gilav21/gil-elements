import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * A decorative glyph before a label. Hidden from assistive technology.
 *
 * @slot - The glyph, usually an emoji or an icon.
 */
export class GeTreeIcon extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(':host{display:inline;margin-inline-end:0.5rem}')];

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('aria-hidden', 'true');
        this.dataset.slot = 'tree-icon';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
