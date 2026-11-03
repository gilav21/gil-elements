import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './input-group-addon.css?inline';

export type InputGroupAddonAlign = 'inline-start' | 'inline-end';

/**
 * Content beside the field of a `ge-input-group`: an icon, a unit, a button. Muted text; a bare `<svg>` is
 * 1rem unless it carries its own `size-*` class.
 *
 * @slot - The addon content.
 * @attr {'inline-start' | 'inline-end'} align - Which end of the row the addon sits at, which sets its padding. Put the element before or after the field to match.
 * @csspart addon - The addon box.
 */
export class GeInputGroupAddon extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = { align: { reflect: true } };

    declare align: InputGroupAddonAlign;

    constructor() {
        super();
        this.align = 'inline-start';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'input-group-addon';
    }

    protected override render() {
        return html`<div class="addon" part="addon" data-slot="input-group-addon" data-align=${this.align}><slot></slot></div>`;
    }
}
