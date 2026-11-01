import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { STEPPER_ITEM_REGISTER, type StepperItemHost } from './stepper-item.js';
import css from './stepper-trigger.css?inline';

/**
 * The button of a step: a numbered circle (a tick once complete) and the step's text. Pressing it goes to
 * that step, if the stepper allows it.
 *
 * @slot - The step's `ge-stepper-title` and `ge-stepper-description`.
 * @csspart base - The `<button>`.
 */
export class GeStepperTrigger extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };

    private item?: StepperItemHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.item = findParent<StepperItemHost, GeStepperTrigger>(this, STEPPER_ITEM_REGISTER);
        this.item?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.item?.unregister(this);
        this.item = undefined;
    }

    protected override render() {
        const status = this.item?.status;
        const stepper = this.item?.stepper;
        const pending = stepper?.guardPending ?? false;
        const canClick = stepper?.canNavigateTo(this.item?.index ?? 0) ?? true;
        return html`<button
            part="base"
            type="button"
            data-slot="stepper-trigger"
            data-status=${status ?? nothing}
            ?disabled=${!canClick || pending}
            aria-busy=${pending ? 'true' : nothing}
            aria-current=${status === 'current' ? 'step' : nothing}
            @click=${this.onClick}
        >
            <div class="indicator" data-status=${status ?? 'pending'}>
                ${status === 'complete'
                    ? html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>`
                    : html`<span class="number">${(this.item?.index ?? 0) + 1}</span>`}
            </div>
            <div class="text"><slot></slot></div>
        </button>`;
    }

    private readonly onClick = () => {
        const index = this.item?.index;
        if (index !== undefined) this.item?.stepper?.goToStep(index);
    };
}
