import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * The action row at the bottom of a drawer; it sticks to the bottom edge of a tall panel.
 *
 * @slot - Buttons or other actions.
 */
export class GeDrawerFooter extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(':host{display:flex;flex-direction:column;gap:0.5rem;margin-top:auto;padding:1rem}')];

    protected override render() {
        return html`<slot></slot>`;
    }
}
