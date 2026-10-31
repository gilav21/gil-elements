import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './kbd.css?inline';

/**
 * A keyboard key cap, rendered with a real `<kbd>` element so assistive technology reads it as input.
 *
 * @slot - The key text, for example `Ctrl` or `K`.
 * @csspart base - The `<kbd>` element.
 */
export class GeKbd extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<kbd part="base"><slot></slot></kbd>`;
    }
}
