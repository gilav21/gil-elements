import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * The text under the drawer's title.
 *
 * @slot - The description text.
 */
export class GeDrawerDescription extends UiElement {
    static override styles = [
        UiElement.styles,
        unsafeCSS(':host{display:block;font-size:0.875rem;line-height:calc(1.25 / 0.875);color:var(--muted-foreground)}'),
    ];

    protected override render() {
        return html`<slot></slot>`;
    }
}
