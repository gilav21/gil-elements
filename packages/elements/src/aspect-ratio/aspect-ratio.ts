import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './aspect-ratio.css?inline';

/**
 * A box that keeps a fixed width-to-height ratio. It fills the available width and reserves its height
 * before its content loads, so nothing shifts. Slotted content is not positioned for you: make it
 * `position: absolute; inset: 0` (or similar) to fill the box.
 *
 * @attr {number} ratio - Width divided by height, e.g. `1.7778` for 16:9. Defaults to `1` (a square).
 * @csspart box - The reserved box; give it `overflow: hidden` and a radius to clip media.
 * @slot - The content that fills the box.
 */
export class GeAspectRatio extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = { ratio: { type: Number, reflect: true } };

    declare ratio: number;

    constructor() {
        super();
        this.ratio = 1;
    }

    protected override render() {
        return html`<div class="box" part="box" data-slot="aspect-ratio" style="padding-bottom: ${(1 / this.ratio) * 100}%"><slot></slot></div>`;
    }
}
