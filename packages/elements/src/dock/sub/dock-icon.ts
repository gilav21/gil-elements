import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * The icon box of a dock item. It fills the item, so the icon grows with the dock's magnification.
 * Style it through `::part(base)` (background, border, radius).
 *
 * @slot - The icon.
 * @csspart base - The box.
 */
export class GeDockIcon extends UiElement {
    static override styles = [
        UiElement.styles,
        unsafeCSS(':host{display:contents}.icon{display:flex;align-items:center;justify-content:center;width:100%;height:100%}'),
    ];

    protected override render() {
        return html`<div part="base" class="icon" data-slot="dock-icon"><slot></slot></div>`;
    }
}
