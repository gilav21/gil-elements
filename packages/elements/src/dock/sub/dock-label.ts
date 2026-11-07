import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * The name bubble above a dock item, shown while the item is hovered. Hover-driven, so it never appears on touch;
 * give the icon an accessible name too.
 *
 * @slot - The text.
 * @csspart base - The bubble.
 */
export class GeDockLabel extends UiElement {
    static override readonly styles = [
        UiElement.styles,
        unsafeCSS(`:host{display:contents}
.label{position:absolute;top:-2.5rem;left:50%;translate:-50% 0;display:var(--ge-dock-label-display,none);padding:0.125rem 0.5rem;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);background-color:var(--popover);color:var(--popover-foreground);font-size:0.75rem;line-height:calc(1 / 0.75);box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.1),0 2px 4px -2px rgb(0 0 0 / 0.1);white-space:nowrap}`),
    ];

    protected override render() {
        return html`<div part="base" class="label" data-slot="dock-label"><slot></slot></div>`;
    }
}
