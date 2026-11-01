import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './stepper-title.css?inline';

/**
 * The step's name.
 *
 * @slot - The text.
 */
export class GeStepperTitle extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<span data-slot="stepper-title"><slot></slot></span>`;
    }
}
