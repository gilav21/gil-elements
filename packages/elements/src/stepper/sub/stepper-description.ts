import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './stepper-description.css?inline';

/**
 * A line of detail under the title.
 *
 * @slot - The text.
 */
export class GeStepperDescription extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<span data-slot="stepper-description"><slot></slot></span>`;
    }
}
