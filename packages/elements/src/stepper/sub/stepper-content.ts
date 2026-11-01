import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { STEPPER_ITEM_REGISTER, type StepperItemHost } from './stepper-item.js';
import css from './stepper-content.css?inline';

/**
 * The panel of a step. It is not rendered unless its step is the current one.
 *
 * @slot - The panel's content.
 * @csspart base - The panel wrapper.
 */
export class GeStepperContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    private item?: StepperItemHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.item = findParent<StepperItemHost, GeStepperContent>(this, STEPPER_ITEM_REGISTER);
        this.item?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.item?.unregister(this);
        this.item = undefined;
    }

    protected override render() {
        if (this.item?.status !== 'current') return nothing;
        return html`<div part="base" class="panel" data-slot="stepper-content"><slot></slot></div>`;
    }
}
