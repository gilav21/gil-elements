import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { STEPPER_ITEM_REGISTER, type StepperItemHost } from './stepper-item.js';
import css from './stepper-separator.css?inline';

/**
 * A line you place yourself, in a `ge-stepper-item`; it turns to the primary colour once its step is complete.
 * It replaces the item's own connector, so a step has one line whether or not you add one.
 *
 * @csspart base - The line.
 */
export class GeStepperSeparator extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];

    private item?: StepperItemHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.item = findParent<StepperItemHost, GeStepperSeparator>(this, STEPPER_ITEM_REGISTER);
        this.item?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.item?.unregister(this);
        this.item = undefined;
    }

    protected override render() {
        return html`<div part="base" class="line" data-slot="stepper-separator" data-orientation=${this.item?.stepper?.orientation ?? 'horizontal'} ?data-complete=${this.item?.status === 'complete'}></div>`;
    }
}
