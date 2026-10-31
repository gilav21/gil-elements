import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './empty-description.css?inline';

/**
 * An empty state's explanation. Slotted links are underlined.
 *
 * @slot - Text, optionally with `<a>` links.
 */
export class GeEmptyDescription extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
