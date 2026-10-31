import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './alert-description.css?inline';

/**
 * The body text of an alert. Slotted paragraphs get relaxed line height.
 *
 * @slot - Description text or paragraphs.
 */
export class GeAlertDescription extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
