import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * The name bubble of a dock item. It sits on the side of the icon facing away from the dock's edge (above a bottom
 * dock, below a top one, beside a left or right one) and shows while the item is hovered or holds focus, so a tapped
 * button or link item shows it on touch too. Give the icon an accessible name as well.
 *
 * @slot - The text.
 * @csspart base - The bubble.
 */
export class GeDockLabel extends UiElement {
    static override readonly styles = [
        UiElement.styles,
        unsafeCSS(`:host{display:contents}
.label{position:absolute;bottom:100%;margin-bottom:0.25rem;left:50%;translate:-50% 0;z-index:10;display:var(--ge-dock-label-display,none);padding:0.125rem 0.5rem;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);background-color:var(--popover);color:var(--popover-foreground);font-size:0.75rem;line-height:calc(1 / 0.75);box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.1),0 2px 4px -2px rgb(0 0 0 / 0.1);white-space:nowrap}
:host([position='top']) .label{bottom:auto;margin:0;top:100%;margin-top:0.25rem}
:host([position='left']) .label{bottom:auto;margin:0;top:50%;left:100%;margin-left:0.25rem;translate:0 -50%}
:host([position='right']) .label{bottom:auto;margin:0;top:50%;left:auto;right:100%;margin-right:0.25rem;translate:0 -50%}`),
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        // A label added later, or one in the dock's own shadow, is told by the dock; one in the page's markup asks.
        const dock = this.closest<HTMLElement & { position?: string }>('ge-dock');
        if (!this.hasAttribute('position') && dock?.position) this.setAttribute('position', dock.position);
    }

    protected override render() {
        return html`<div part="base" class="label" data-slot="dock-label"><slot></slot></div>`;
    }
}
