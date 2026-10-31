import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './button-group-text.css?inline';

/**
 * Static text that sits inside a button group, for example a currency prefix or a count.
 *
 * @slot - Text, optionally with an `<svg>` icon (sized to 1rem unless it sets its own size).
 */
export class GeButtonGroupText extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<div class="text" part="base"><slot></slot></div>`;
    }
}
