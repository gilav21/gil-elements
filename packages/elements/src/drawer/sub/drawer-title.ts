import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * The drawer's title.
 *
 * @slot - The title text.
 */
export class GeDrawerTitle extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(':host{display:block;font-weight:600;color:var(--foreground)}')];

    protected override render() {
        return html`<slot></slot>`;
    }
}
